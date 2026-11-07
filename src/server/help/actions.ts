"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { HelpErrorKey } from "@/i18n/messages";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { askHelp } from "@/server/ai/help";
import { getAiProvider } from "@/server/ai/provider";
import { requireUserId } from "@/server/auth/session";
import { enqueue } from "@/server/jobs/client";
import { QUEUES } from "@/server/jobs/queues";

import { articlesForCountry } from "./queries";

export interface HelpFormState {
  error?: HelpErrorKey;
  sent?: boolean;
}

const questionSchema = z.string().trim().min(1).max(1000);
const messageSchema = z.string().trim().min(1).max(2000);

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function quotaError(message: string): HelpErrorKey {
  return message.includes("LULU_QUOTA_AIDE_ATTEINT") ? "quotaReached" : "unknown";
}

/**
 * Pose une question à l'assistant d'aide. La base compte la question (limite
 * quotidienne) avant tout appel au modèle ; elle ne touche pas au forfait.
 */
export async function askHelpAction(_prev: HelpFormState, formData: FormData): Promise<HelpFormState> {
  const userId = await requireUserId();
  const parsed = questionSchema.safeParse(field(formData, "question"));
  if (!parsed.success) return { error: "empty" };

  const supabase = await createUserClient();
  const service = createServiceClient();
  const { data: profile } = await supabase.from("profiles").select("country_code").eq("id", userId).single();
  if (!profile) return { error: "unknown" };

  const { data: row, error } = await service
    .from("help_questions")
    .insert({ user_id: userId, question: parsed.data })
    .select("id")
    .single();
  if (error || !row) return { error: quotaError(error?.message ?? "") };

  const answer = await askHelp(getAiProvider(), {
    question: parsed.data,
    articles: articlesForCountry(profile.country_code),
  });

  await service.from("help_questions").update({ answer: answer.text }).eq("id", row.id);
  if (answer.usage) {
    await service.from("ai_usage").insert({
      user_id: userId,
      country_code: profile.country_code,
      feature: "help",
      model: answer.usage.model,
      input_tokens: answer.usage.inputTokens,
      output_tokens: answer.usage.outputTokens,
      cache_read_tokens: answer.usage.cacheReadTokens,
    });
  }

  revalidatePath("/aide");
  return {};
}

/** Avis « utile / pas utile » sur une réponse ; la RLS limite aux questions de l'utilisateur. */
export async function rateHelpAnswerAction(formData: FormData): Promise<void> {
  await requireUserId();
  const id = z.coerce.number().int().positive().safeParse(field(formData, "id"));
  const helpful = field(formData, "helpful");
  if (!id.success || (helpful !== "1" && helpful !== "0")) return;
  const supabase = await createUserClient();
  await supabase.from("help_questions").update({ helpful: helpful === "1" }).eq("id", id.data);
  revalidatePath("/aide");
}

/** Message écrit à l'équipe ATUMI, enregistré pour l'administration. */
export async function contactTeamAction(_prev: HelpFormState, formData: FormData): Promise<HelpFormState> {
  const userId = await requireUserId();
  const parsed = messageSchema.safeParse(field(formData, "message"));
  if (!parsed.success) return { error: "empty" };

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("support_requests")
    .insert({ user_id: userId, message: parsed.data })
    .select("id")
    .single();
  if (error || !data) return { error: quotaError(error?.message ?? "") };

  // Le message est enregistré : un échec de la file n'empêche pas l'équipe de le lire.
  try {
    await enqueue(QUEUES.supportNotify, { requestId: data.id });
  } catch (cause) {
    console.error("[aide] envoi à l'équipe non programmé", cause);
  }
  return { sent: true };
}
