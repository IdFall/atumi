import type { Cycle, TutorLanguage } from "@/config/countries";
import { getMessages } from "@/i18n/messages";
import { canRevealSolution } from "@/server/learning/policies";

import { tutorSystemPrompt, tutorUserTurn, type TutorMode } from "./prompts";
import type { AiMessage, AiProvider, AiUsage, SourcePassage } from "./types";

export interface TutorInput {
  mode: TutorMode;
  cycle: Cycle;
  /** Langue de réponse choisie par l'apprenant (fr par défaut). */
  language?: TutorLanguage;
  question: string;
  /** Historique résumé ou récent de la conversation. */
  history: AiMessage[];
  /** Passages trouvés dans les documents de l'apprenant, déjà filtrés sur son compte. */
  passages: SourcePassage[];
  /** Tentatives de l'apprenant sur l'exercice en cours, s'il y en a un. */
  exerciseAttempts: string[];
}

export interface TutorOutput {
  text: string;
  citedChunkIds: number[];
  usage: AiUsage | null;
}

/** Repère les identifiants de passages réellement fournis et cités. */
function citedChunks(text: string, passages: readonly SourcePassage[]): number[] {
  const pages = new Set(
    [...text.matchAll(/\[p\.\s*(\d+)\]/g)].map((m) => Number(m[1])),
  );
  return passages.filter((p) => p.page !== null && pages.has(p.page)).map((p) => p.chunkId);
}

export async function askTutor(provider: AiProvider, input: TutorInput): Promise<TutorOutput> {
  const messages = getMessages("fr");
  const solutionAllowed = canRevealSolution(input.exerciseAttempts);

  const result = await provider.complete({
    feature: "tutor",
    tier: "standard",
    system: tutorSystemPrompt(input.mode, input.cycle, input.language ?? "fr"),
    messages: [
      ...input.history,
      { role: "user", content: tutorUserTurn(input.question, input.passages, solutionAllowed) },
    ],
  });

  if (result.status === "unavailable") {
    return { text: messages.tutor.unavailable, citedChunkIds: [], usage: null };
  }
  if (result.status === "refused") {
    return { text: messages.tutor.unavailable, citedChunkIds: [], usage: result.usage };
  }
  return { text: result.text, citedChunkIds: citedChunks(result.text, input.passages), usage: result.usage };
}

/** Réponse fixe en cas de contestation : pas d'appel au modèle, pas de débat. */
export function contestationReply(): string {
  return getMessages("fr").tutor.contestationReply;
}
