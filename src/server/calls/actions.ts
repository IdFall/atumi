"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CALL_HEARTBEAT_SECONDS, CALL_LANGUAGES, CALL_TRANSCRIPT_MAX_CHARS, MAX_CALL_SECONDS, MIN_CALL_SECONDS, type CallLanguage } from "@/config/calls";
import { isTutorLanguageOffered, type Cycle } from "@/config/countries";
import { getMessages } from "@/i18n/messages";
import { getLocale } from "@/i18n/server";
import { billedSeconds, formatCallTranscript } from "@/lib/call";
import { serverEnv } from "@/lib/env";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { callSystemPrompt, type TutorMode } from "@/server/ai/prompts";
import { createVoiceToken } from "@/server/ai/voice";
import { requireUserId } from "@/server/auth/session";

/**
 * Appels avec le Prof NEO. Le serveur crée l'appel (minutes du forfait
 * vérifiées avant), donne au navigateur un jeton Gemini Live limité aux
 * minutes restantes, suit la durée par des signaux réguliers et la clôture.
 * Seule la transcription est gardée, comme un message de la conversation.
 */

export type StartCallError = "unavailable" | "noMinutes" | "accessExpired" | "unknown";

export type StartCallResult =
  | { ok: true; callId: string; conversationId: string; token: string; model: string; maxSeconds: number; language: CallLanguage }
  | { ok: false; error: StartCallError };

const MODES = ["expliquer", "approfondir", "exercer", "decouvrir"] as const satisfies readonly TutorMode[];
const HISTORY_SIZE = 10;
const HISTORY_ITEM_CHARS = 1500;
const SYNTHESIS_CHARS = 6000;

const startSchema = z.object({
  conversationId: z.uuid().nullable(),
  mode: z.enum(MODES),
  moduleId: z.uuid().nullable(),
  chapterId: z.uuid().nullable(),
  withVideo: z.boolean(),
});

type Service = ReturnType<typeof createServiceClient>;

/** Appels restés ouverts (onglet fermé, réseau coupé) : facturés jusqu'au dernier signal reçu. */
async function closeStaleCalls(service: Service, userId: string, now: Date) {
  const { data } = await service.from("tutor_calls").select("id, started_at").eq("user_id", userId).is("ended_at", null);
  for (const call of data ?? []) {
    const duration = billedSeconds(new Date(call.started_at), now, CALL_HEARTBEAT_SECONDS);
    await service
      .from("tutor_calls")
      .update({ ended_at: now.toISOString(), duration_seconds: duration, end_reason: "connexion" })
      .eq("id", call.id)
      .is("ended_at", null);
  }
}

export async function startCallAction(raw: z.input<typeof startSchema>): Promise<StartCallResult> {
  const userId = await requireUserId();
  const parsed = startSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "unknown" };
  const input = parsed.data;

  const env = serverEnv();
  if (!env.GEMINI_API_KEY) return { ok: false, error: "unavailable" };

  const supabase = await createUserClient();
  const service = createServiceClient();
  const now = new Date();
  await closeStaleCalls(service, userId, now);

  const { data: quota } = await supabase.rpc("call_quota");
  const row = (quota as { seconds_remaining: number | null; minutes_limit: number | null }[] | null)?.[0];
  if (!row) return { ok: false, error: "accessExpired" };
  if (row.seconds_remaining !== null && row.seconds_remaining < MIN_CALL_SECONDS) return { ok: false, error: "noMinutes" };
  const maxSeconds = Math.min(MAX_CALL_SECONDS, row.seconds_remaining ?? MAX_CALL_SECONDS);

  const { data: profile } = await supabase.from("profiles").select("cycle, country_code, tutor_language").eq("id", userId).single();
  if (!profile) return { ok: false, error: "unknown" };
  // Le wolof n'est pas encore proposé à l'oral : l'appel se fait alors en français.
  const language: CallLanguage =
    isTutorLanguageOffered(profile.country_code, profile.tutor_language) && (CALL_LANGUAGES as readonly string[]).includes(profile.tutor_language)
      ? (profile.tutor_language as CallLanguage)
      : "fr";

  // Conversation : existante (vérifiée par RLS) ou nouvelle, comme pour un message écrit.
  let conversation: { id: string; mode: TutorMode; chapter_id: string | null };
  if (input.conversationId) {
    const { data } = await supabase.from("tutor_conversations").select("id, mode, chapter_id").eq("id", input.conversationId).maybeSingle();
    if (!data) return { ok: false, error: "unknown" };
    conversation = data;
  } else {
    const scoped = input.mode !== "decouvrir";
    const { data, error } = await supabase
      .from("tutor_conversations")
      .insert({
        user_id: userId,
        mode: input.mode,
        module_id: scoped ? input.moduleId : null,
        chapter_id: scoped ? input.chapterId : null,
      })
      .select("id, mode, chapter_id")
      .single();
    if (error) return { ok: false, error: "unknown" };
    conversation = data;
  }

  const [{ data: previous }, chapter, synthesis] = await Promise.all([
    supabase
      .from("tutor_messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("id", { ascending: false })
      .limit(HISTORY_SIZE),
    conversation.chapter_id ? supabase.from("chapters").select("title").eq("id", conversation.chapter_id).maybeSingle() : null,
    conversation.chapter_id
      ? supabase
          .from("syntheses")
          .select("content_md")
          .eq("chapter_id", conversation.chapter_id)
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : null,
  ]);

  const system = callSystemPrompt(conversation.mode, profile.cycle as Cycle, language, {
    chapterTitle: chapter?.data?.title ?? null,
    synthesis: synthesis?.data?.content_md ? synthesis.data.content_md.slice(0, SYNTHESIS_CHARS) : null,
    history: ((previous ?? []) as { role: "user" | "assistant"; content: string }[])
      .reverse()
      .map((m) => ({ role: m.role, content: m.content.slice(0, HISTORY_ITEM_CHARS) })),
  });

  const { data: call, error: callError } = await service
    .from("tutor_calls")
    .insert({ user_id: userId, conversation_id: conversation.id, language, with_video: input.withVideo })
    .select("id")
    .single();
  if (callError || !call) return { ok: false, error: "unknown" };

  const token = await createVoiceToken({
    apiKey: env.GEMINI_API_KEY,
    model: env.ATUMI_VOICE_MODEL,
    systemInstruction: system,
    language,
    maxSeconds,
  });
  if (!token) {
    await service
      .from("tutor_calls")
      .update({ ended_at: new Date().toISOString(), duration_seconds: 0, end_reason: "erreur" })
      .eq("id", call.id);
    return { ok: false, error: "unavailable" };
  }

  return { ok: true, callId: call.id, conversationId: conversation.id, token, model: env.ATUMI_VOICE_MODEL, maxSeconds, language };
}

/** Durée provisoire de l'appel en cours : si le navigateur disparaît, l'appel est facturé jusqu'ici. */
export async function heartbeatCallAction(callId: string): Promise<void> {
  const userId = await requireUserId();
  if (!z.uuid().safeParse(callId).success) return;
  const service = createServiceClient();
  const { data: call } = await service
    .from("tutor_calls")
    .select("id, started_at, end_reason")
    .eq("id", callId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!call || (call.end_reason !== null && call.end_reason !== "connexion")) return;
  const now = new Date();
  await service
    .from("tutor_calls")
    .update({
      ended_at: now.toISOString(),
      duration_seconds: billedSeconds(new Date(call.started_at), now, MAX_CALL_SECONDS),
      end_reason: "connexion",
    })
    .eq("id", call.id);
}

const endSchema = z.object({
  callId: z.uuid(),
  reason: z.enum(["raccroche", "quota", "connexion", "erreur"]),
  transcript: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(CALL_TRANSCRIPT_MAX_CHARS) }))
    .max(500),
  usage: z.object({ inputTokens: z.number().int().min(0), outputTokens: z.number().int().min(0) }).nullable(),
});

/** Fin de l'appel : durée facturée, transcription gardée dans la conversation, consommation journalisée. */
export async function endCallAction(raw: z.input<typeof endSchema>): Promise<void> {
  const userId = await requireUserId();
  const parsed = endSchema.safeParse(raw);
  if (!parsed.success) return;
  const input = parsed.data;
  const service = createServiceClient();

  const { data: call } = await service
    .from("tutor_calls")
    .select("id, conversation_id, started_at, end_reason")
    .eq("id", input.callId)
    .eq("user_id", userId)
    .maybeSingle();
  // Déjà clôturé (fin envoyée deux fois) : rien à refaire.
  if (!call || (call.end_reason !== null && call.end_reason !== "connexion")) return;

  const now = new Date();
  const duration = billedSeconds(new Date(call.started_at), now, MAX_CALL_SECONDS);
  await service
    .from("tutor_calls")
    .update({ ended_at: now.toISOString(), duration_seconds: duration, end_reason: input.reason })
    .eq("id", call.id);

  const t = getMessages(await getLocale());
  const minutes = Math.max(1, Math.round(duration / 60));
  const transcript = formatCallTranscript(
    input.transcript,
    {
      title: t.call.transcriptTitle.replace("{minutes}", String(minutes)),
      user: t.call.transcriptYou,
      assistant: t.tutor.name,
    },
    CALL_TRANSCRIPT_MAX_CHARS,
  );
  if (transcript) {
    // Message du professeur : il ne compte pas dans les messages du forfait (les minutes sont déjà comptées).
    await service.from("tutor_messages").insert({ user_id: userId, conversation_id: call.conversation_id, role: "assistant", content: transcript });
  }

  if (input.usage) {
    // Chiffres envoyés par le navigateur : bornés à ce qu'un appel de cette durée peut consommer.
    const cap = Math.max(duration, 1) * 400;
    const { data: profile } = await service.from("profiles").select("country_code").eq("id", userId).maybeSingle();
    await service.from("ai_usage").insert({
      user_id: userId,
      country_code: profile?.country_code ?? null,
      feature: "call",
      model: serverEnv().ATUMI_VOICE_MODEL,
      input_tokens: Math.min(input.usage.inputTokens, cap),
      output_tokens: Math.min(input.usage.outputTokens, cap),
    });
  }

  revalidatePath(`/professeur/${call.conversation_id}`);
}
