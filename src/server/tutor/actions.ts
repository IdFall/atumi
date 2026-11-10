"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isTutorLanguageOffered, type Cycle, type TutorLanguage } from "@/config/countries";
import { fill } from "@/i18n/format";
import { getMessages } from "@/i18n/messages";
import { canExploreFurther } from "@/lib/further";
import { conceptOf, extractOutsideMarker } from "@/lib/outside-course";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { BOARD_MODES, type TutorMode } from "@/server/ai/prompts";
import { getAiProvider } from "@/server/ai/provider";
import { askFurther } from "@/server/ai/research";
import { askTutor } from "@/server/ai/tutor";
import { requireUserId } from "@/server/auth/session";

import { resolveBoardImages } from "./board-images";
import { findPassages } from "./passages";

export type TutorErrorKey = "empty" | "quotaReached" | "accessExpired" | "unknown";

export interface TutorFormState {
  error?: TutorErrorKey;
}

const MODES = ["expliquer", "approfondir", "exercer", "decouvrir"] as const satisfies readonly TutorMode[];
/** Nombre de messages récents renvoyés au modèle comme historique. */
const HISTORY_SIZE = 10;

const inputSchema = z.object({
  conversationId: z.union([z.uuid(), z.literal("")]),
  mode: z.enum(MODES),
  moduleId: z.union([z.uuid(), z.literal("")]),
  chapterId: z.union([z.uuid(), z.literal("")]),
  text: z.string().trim().min(1).max(4000),
});

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function quotaError(message: string): TutorErrorKey {
  if (message.includes("LULU_QUOTA_MESSAGES_ATTEINT")) return "quotaReached";
  if (message.includes("LULU_ACCES_EXPIRE")) return "accessExpired";
  return "unknown";
}

/**
 * Envoie un message au professeur et enregistre sa réponse. La base compte le
 * message de l'apprenant (limite du forfait) avant tout appel au modèle.
 */
export async function sendTutorMessageAction(_prev: TutorFormState, formData: FormData): Promise<TutorFormState> {
  const userId = await requireUserId();
  const parsed = inputSchema.safeParse({
    conversationId: field(formData, "conversationId"),
    mode: field(formData, "mode"),
    moduleId: field(formData, "moduleId"),
    chapterId: field(formData, "chapterId"),
    text: field(formData, "text"),
  });
  if (!parsed.success) return { error: parsed.error.issues.some((i) => i.path[0] === "text") ? "empty" : "unknown" };
  const input = parsed.data;

  const supabase = await createUserClient();
  const service = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("cycle, country_code, tutor_language")
    .eq("id", userId)
    .single();
  if (!profile) return { error: "unknown" };

  // Conversation : existante (vérifiée par RLS) ou nouvelle.
  let conversation: { id: string; mode: TutorMode; module_id: string | null; chapter_id: string | null };
  const isNew = input.conversationId === "";
  if (!isNew) {
    const { data } = await supabase
      .from("tutor_conversations")
      .select("id, mode, module_id, chapter_id")
      .eq("id", input.conversationId)
      .maybeSingle();
    if (!data) return { error: "unknown" };
    conversation = data;
  } else {
    // Les clés étrangères (module_id, user_id) refusent le module d'un autre utilisateur.
    const { data, error } = await supabase
      .from("tutor_conversations")
      .insert({
        user_id: userId,
        mode: input.mode,
        module_id: input.mode === "decouvrir" ? null : input.moduleId || null,
        chapter_id: input.mode === "decouvrir" ? null : input.chapterId || null,
      })
      .select("id, mode, module_id, chapter_id")
      .single();
    if (error) return { error: "unknown" };
    conversation = data;
  }

  const passages =
    conversation.mode === "decouvrir"
      ? []
      : await findPassages(supabase, {
          mode: conversation.mode,
          moduleId: conversation.module_id,
          chapterId: conversation.chapter_id,
          question: input.text,
        });

  const language: TutorLanguage = isTutorLanguageOffered(profile.country_code, profile.tutor_language)
    ? profile.tutor_language
    : "fr";

  // Première question d'Explication sur une notion absente du cours : réponse
  // immédiate, sans appel au modèle ni décompte, avec les boutons qui lancent
  // la recherche web ou l'encyclopédie sans ressaisie.
  if (isNew && conversation.mode === "expliquer" && passages.length === 0) {
    const term = conceptOf(input.text);
    const t = getMessages(language === "en" ? "en" : "fr");
    await service.from("tutor_messages").insert({
      user_id: userId,
      conversation_id: conversation.id,
      role: "assistant",
      content: fill(t.tutor.outside.notFound, { term }),
      citations: [{ outsideTerm: term, question: input.text }],
    });
    redirect(`/professeur/${conversation.id}`);
  }

  // Message de l'apprenant : écrit par le serveur, compté par la base.
  const { error: quotaRefusal } = await service
    .from("tutor_messages")
    .insert({ user_id: userId, conversation_id: conversation.id, role: "user", content: input.text });
  if (quotaRefusal) {
    if (isNew) await supabase.from("tutor_conversations").delete().eq("id", conversation.id);
    return { error: quotaError(quotaRefusal.message) };
  }

  const { data: previous } = await supabase
    .from("tutor_messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("id", { ascending: false })
    .limit(HISTORY_SIZE + 1);
  const history = (previous ?? []).slice(1).reverse() as { role: "user" | "assistant"; content: string }[];

  // S'exercer : les messages de l'apprenant dans cette conversation sont ses tentatives.
  const attempts =
    conversation.mode === "exercer"
      ? [...history.filter((m) => m.role === "user").map((m) => m.content), input.text]
      : [];

  const answer = await askTutor(getAiProvider(), {
    mode: conversation.mode,
    cycle: profile.cycle as Cycle,
    language,
    question: input.text,
    history,
    passages,
    exerciseAttempts: attempts,
  });

  // Notion absente du cours : le modèle l'annonce par une ligne retirée ici.
  const outside = extractOutsideMarker(answer.text);
  await service.from("tutor_messages").insert({
    user_id: userId,
    conversation_id: conversation.id,
    role: "assistant",
    content: BOARD_MODES.includes(conversation.mode) ? await resolveBoardImages(outside.text) : outside.text,
    citations: [
      ...passages
        .filter((p) => answer.citedChunkIds.includes(p.chunkId))
        .map((p) => ({ chunkId: p.chunkId, page: p.page, documentTitle: p.documentTitle })),
      ...(outside.term ? [{ outsideTerm: outside.term, question: input.text }] : []),
    ],
  });
  if (answer.usage) {
    await service.from("ai_usage").insert({
      user_id: userId,
      country_code: profile.country_code,
      feature: "tutor",
      model: answer.usage.model,
      input_tokens: answer.usage.inputTokens,
      output_tokens: answer.usage.outputTokens,
      cache_read_tokens: answer.usage.cacheReadTokens,
    });
  }

  revalidatePath(`/professeur/${conversation.id}`);
  if (isNew) redirect(`/professeur/${conversation.id}`);
  return {};
}

/** Langue de réponse du professeur, parmi celles proposées dans le pays de l'apprenant. */
export async function setTutorLanguageAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const language = field(formData, "language");
  const supabase = await createUserClient();
  const { data: profile } = await supabase.from("profiles").select("country_code").eq("id", userId).single();
  if (!profile || !isTutorLanguageOffered(profile.country_code, language)) return;
  await supabase.from("profiles").update({ tutor_language: language }).eq("id", userId);
  revalidatePath("/professeur", "layout");
}

export type FurtherErrorKey = "quotaReached" | "noAccess" | "unavailable" | "unknown";

export interface FurtherFormState {
  error?: FurtherErrorKey;
}

function furtherQuotaError(message: string): FurtherErrorKey {
  if (message.includes("LULU_QUOTA_RECHERCHE_ATTEINT")) return "quotaReached";
  if (message.includes("LULU_ACCES_EXPIRE")) return "noAccess";
  return "unknown";
}

/**
 * « Pour aller plus loin » : prolonge la dernière explication du cours avec
 * d'autres sources crédibles du web. Compte comme une recherche web : la base
 * vérifie la limite par 24 h (`research_questions`) avant tout appel au
 * modèle. La suite est gardée comme un message du professeur (hors décompte
 * des messages), ses sources web dans les citations.
 */
export async function exploreFurtherAction(_prev: FurtherFormState, formData: FormData): Promise<FurtherFormState> {
  const userId = await requireUserId();
  const conversationId = z.uuid().safeParse(field(formData, "conversationId"));
  if (!conversationId.success) return { error: "unknown" };

  const supabase = await createUserClient();
  const service = createServiceClient();

  // Conversation et derniers messages, vérifiés par RLS.
  const [{ data: conversation }, { data: profile }] = await Promise.all([
    supabase
      .from("tutor_conversations")
      .select("id, mode, tutor_messages(id, role, content, citations)")
      .eq("id", conversationId.data)
      .maybeSingle(),
    supabase.from("profiles").select("cycle, country_code, tutor_language").eq("id", userId).single(),
  ]);
  if (!conversation || !profile) return { error: "unknown" };
  const messages = [...(conversation.tutor_messages ?? [])].sort((a, b) => a.id - b.id) as {
    role: "user" | "assistant";
    content: string;
    citations: unknown[];
  }[];
  if (!canExploreFurther(conversation.mode, messages.map((m) => ({ ...m, citations: m.citations ?? [] })))) return { error: "unknown" };
  const explanation = messages.at(-1)!.content;
  const question = messages.findLast((m) => m.role === "user")!.content;

  const locale = isTutorLanguageOffered(profile.country_code, profile.tutor_language) && profile.tutor_language === "en" ? "en" : "fr";
  const label = locale === "en" ? "Go further" : "Pour aller plus loin";

  // Comptée comme une recherche web par la base (limite par 24 h, refus sans droit).
  const { data: row, error } = await service
    .from("research_questions")
    .insert({ user_id: userId, question: `${label} : ${question}`.slice(0, 500) })
    .select("id")
    .single();
  if (error || !row) return { error: furtherQuotaError(error?.message ?? "") };

  const answer = await askFurther(getAiProvider(), {
    question,
    explanation,
    cycle: profile.cycle as Cycle,
    locale,
    country: profile.country_code,
  });

  if (answer.answered) {
    await service.from("research_questions").update({ answer: answer.text, sources: answer.sources }).eq("id", row.id);
    await service.from("tutor_messages").insert({
      user_id: userId,
      conversation_id: conversation.id,
      role: "assistant",
      content: `## ${label}\n\n${answer.text}`,
      citations: answer.sources.map((s) => ({ url: s.url, title: s.title })),
    });
  } else {
    // L'IA n'a pas répondu : la recherche est retirée et ne compte pas.
    await service.from("research_questions").delete().eq("id", row.id);
  }
  if (answer.usage) {
    await service.from("ai_usage").insert({
      user_id: userId,
      country_code: profile.country_code,
      feature: "research",
      model: answer.usage.model,
      input_tokens: answer.usage.inputTokens,
      output_tokens: answer.usage.outputTokens,
      cache_read_tokens: answer.usage.cacheReadTokens,
    });
  }

  revalidatePath(`/professeur/${conversation.id}`);
  revalidatePath("/recherche");
  return answer.answered ? {} : { error: "unavailable" };
}
