"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ResearchErrorKey } from "@/i18n/messages";
import { getLocale } from "@/i18n/server";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { getAiProvider } from "@/server/ai/provider";
import { askResearch } from "@/server/ai/research";
import { getCurrentUser, requireUserId } from "@/server/auth/session";
import { researchQuestionSchema } from "@/server/validation";

export interface ResearchFormState {
  error?: ResearchErrorKey;
}

const questionSchema = researchQuestionSchema;

function quotaError(message: string): ResearchErrorKey {
  if (message.includes("LULU_QUOTA_RECHERCHE_ATTEINT")) return "quotaReached";
  if (message.includes("LULU_ACCES_EXPIRE")) return "noAccess";
  return "unknown";
}

/**
 * Recherche IA avec sources web. La base compte la question (limite par 24 h
 * selon le forfait, refus sans droit) avant tout appel au modèle ; le serveur
 * écrit ensuite la réponse et ses sources, puis journalise la consommation.
 */
export async function askResearchAction(_prev: ResearchFormState, formData: FormData): Promise<ResearchFormState> {
  await requireUserId();
  const value = formData.get("question");
  const parsed = questionSchema.safeParse(typeof value === "string" ? value : "");
  if (!parsed.success) return { error: "empty" };

  const user = await getCurrentUser();
  const service = createServiceClient();
  const { data: row, error } = await service
    .from("research_questions")
    .insert({ user_id: user.id, question: parsed.data })
    .select("id")
    .single();
  if (error || !row) return { error: quotaError(error?.message ?? "") };

  let answer: Awaited<ReturnType<typeof askResearch>>;
  try {
    answer = await askResearch(getAiProvider(), {
      question: parsed.data,
      cycle: user.cycle,
      locale: await getLocale(),
      country: user.countryCode,
    });
  } catch (cause) {
    // Erreur imprévue : la question sans réponse ne doit pas rester comptée.
    await service.from("research_questions").delete().eq("id", row.id);
    throw cause;
  }

  if (answer.answered) {
    await service.from("research_questions").update({ answer: answer.text, sources: answer.sources }).eq("id", row.id);
  } else {
    // L'IA n'a pas répondu : la question, sans réponse, est retirée et ne compte pas.
    await service.from("research_questions").delete().eq("id", row.id);
  }
  if (answer.usage) {
    await service.from("ai_usage").insert({
      user_id: user.id,
      country_code: user.countryCode,
      feature: "research",
      model: answer.usage.model,
      input_tokens: answer.usage.inputTokens,
      output_tokens: answer.usage.outputTokens,
      cache_read_tokens: answer.usage.cacheReadTokens,
    });
  }

  revalidatePath("/recherche");
  return answer.answered ? {} : { error: "unavailable" };
}

/** Efface une recherche de l'historique (elle reste comptée pour la limite du jour). */
export async function deleteResearchAction(formData: FormData): Promise<void> {
  await requireUserId();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createUserClient();
  await supabase.from("research_questions").delete().eq("id", id.data);
  revalidatePath("/recherche");
}
