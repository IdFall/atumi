import type { HelpArticle } from "@/i18n/help-articles";
import { getMessages } from "@/i18n/messages";

import { helpSystemPrompt, helpUserTurn } from "./prompts";
import type { AiProvider, AiUsage } from "./types";

export interface HelpAnswer {
  text: string;
  usage: AiUsage | null;
}

/** Réponse de l'assistant d'aide, limitée aux articles fournis. */
export async function askHelp(
  provider: AiProvider,
  input: { question: string; articles: readonly HelpArticle[] },
): Promise<HelpAnswer> {
  const t = getMessages("fr");
  const result = await provider.complete({
    feature: "help",
    tier: "light",
    system: helpSystemPrompt(input.articles),
    messages: [{ role: "user", content: helpUserTurn(input.question) }],
    maxTokens: 600,
  });
  if (result.status === "ok") return { text: result.text, usage: result.usage };
  return { text: t.help.unavailable, usage: result.status === "refused" ? result.usage : null };
}
