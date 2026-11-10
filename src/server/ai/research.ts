import type { Cycle, Locale } from "@/config/countries";
import { getMessages } from "@/i18n/messages";

import { furtherSystemPrompt, furtherUserTurn, researchSystemPrompt, researchUserTurn } from "./prompts";
import type { AiProvider, AiSource, AiUsage } from "./types";

export interface ResearchAnswer {
  text: string;
  sources: AiSource[];
  usage: AiUsage | null;
  /** false quand l'IA n'a pas pu répondre (indisponible ou refus). */
  answered: boolean;
}

/** Nombre maximal de recherches web par question (coût borné). */
export const RESEARCH_MAX_SEARCHES = 3;

/** Réponse à une question libre, appuyée sur une recherche web et ses sources. */
export async function askResearch(
  provider: AiProvider,
  input: { question: string; cycle: Cycle; locale?: Locale; country?: string },
): Promise<ResearchAnswer> {
  const locale = input.locale ?? "fr";
  const t = getMessages(locale);
  const result = await provider.complete({
    feature: "research",
    tier: "standard",
    system: researchSystemPrompt(input.cycle, locale),
    messages: [{ role: "user", content: researchUserTurn(input.question) }],
    maxTokens: 4000,
    webSearch: { maxUses: RESEARCH_MAX_SEARCHES, country: input.country },
  });
  if (result.status === "ok" && result.text.trim()) {
    return { text: result.text.trim(), sources: result.sources ?? [], usage: result.usage, answered: true };
  }
  return {
    text: result.status === "refused" ? t.research.refused : t.research.unavailable,
    sources: [],
    usage: result.status === "unavailable" ? null : result.usage,
    answered: false,
  };
}

/**
 * « Pour aller plus loin » : suite d'une explication du Prof ATUM tirée du
 * cours, appuyée sur d'autres sources crédibles trouvées sur le web.
 */
export async function askFurther(
  provider: AiProvider,
  input: { question: string; explanation: string; cycle: Cycle; locale?: Locale; country?: string },
): Promise<ResearchAnswer> {
  const locale = input.locale ?? "fr";
  const t = getMessages(locale);
  const result = await provider.complete({
    feature: "research",
    tier: "standard",
    system: furtherSystemPrompt(input.cycle, locale),
    messages: [{ role: "user", content: furtherUserTurn(input.question, input.explanation) }],
    maxTokens: 4000,
    webSearch: { maxUses: RESEARCH_MAX_SEARCHES, country: input.country },
  });
  if (result.status === "ok" && result.text.trim()) {
    return { text: result.text.trim(), sources: result.sources ?? [], usage: result.usage, answered: true };
  }
  return {
    text: t.research.unavailable,
    sources: [],
    usage: result.status === "unavailable" ? null : result.usage,
    answered: false,
  };
}
