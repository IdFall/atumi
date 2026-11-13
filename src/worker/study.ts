/**
 * Génération des synthèses et des quiz à partir des passages du cours.
 * Le serveur a déjà créé la ligne « en préparation » (et vérifié le quota) ;
 * ici on appelle le modèle, on vérifie sa réponse et on enregistre le résultat.
 */
import type { Cycle } from "../config/countries";
import { quizSystemPrompt, quizUserTurn, synthesisSystemPrompt, synthesisUserTurn } from "../server/ai/prompts";
import type { AiFeature, AiProvider, AiUsage, SourcePassage } from "../server/ai/types";
import { parseGeneratedQuiz, type GeneratedQuestion } from "../server/study/quiz";

export interface StudyJob {
  id: string;
  userId: string;
  moduleId: string;
  chapterId: string | null;
  status: string;
  cycle: Cycle;
  countryCode: string;
}

export interface QuizJob extends StudyJob {
  questionCount: number;
}

export interface PassageSet {
  passages: SourcePassage[];
  documentIds: string[];
}

export interface StudyStore {
  getSynthesisJob(userId: string, synthesisId: string): Promise<StudyJob | null>;
  getQuizJob(userId: string, quizId: string): Promise<QuizJob | null>;
  /** Passages des documents prêts du chapitre (ou du module entier), dans l'ordre du cours. */
  getPassages(job: StudyJob, maxChars: number): Promise<PassageSet>;
  saveSynthesis(job: StudyJob, contentMd: string, documentIds: string[]): Promise<void>;
  failSynthesis(job: StudyJob, reason: string): Promise<void>;
  saveQuestions(job: QuizJob, questions: GeneratedQuestion[], passages: SourcePassage[]): Promise<void>;
  failQuiz(job: QuizJob, reason: string): Promise<void>;
  logUsage(job: StudyJob, feature: AiFeature, usage: AiUsage): Promise<void>;
}

/** Plafond de texte envoyé au modèle, pour maîtriser le coût d'une génération. */
export const MAX_SOURCE_CHARS = 60_000;

export const STUDY_FAILURES = {
  noContent: "Aucun document lisible dans ce chapitre pour l'instant.",
  refused: "AtumiNeo n'a pas pu traiter ce contenu.",
  invalid: "La génération n'a pas abouti. Réessaie dans un instant.",
  aiDisabled: "Le service d'IA d'AtumiNeo n'est pas encore activé. Réessaie plus tard.",
} as const;

/** Sans clé d'API, inutile de relancer : la ligne est clôturée tout de suite. */
function isPermanentlyUnavailable(reason: string): boolean {
  // Clé absente ou requête refusée par le fournisseur (4xx) : relancer ne changerait rien.
  return reason === "missing_api_key" || reason.startsWith("request_");
}

/** Erreur passagère : pg-boss relancera le travail. */
export class TemporaryAiError extends Error {}

export type StudyResult = "ready" | "failed" | "skipped";

export async function generateSynthesis(
  store: StudyStore,
  provider: AiProvider,
  userId: string,
  synthesisId: string,
): Promise<StudyResult> {
  const job = await store.getSynthesisJob(userId, synthesisId);
  if (!job || job.status !== "generating") return "skipped";

  const { passages, documentIds } = await store.getPassages(job, MAX_SOURCE_CHARS);
  if (passages.length === 0) {
    await store.failSynthesis(job, STUDY_FAILURES.noContent);
    return "failed";
  }

  const result = await provider.complete({
    feature: "synthesis",
    tier: "standard",
    system: synthesisSystemPrompt(job.cycle),
    messages: [{ role: "user", content: synthesisUserTurn(passages) }],
    maxTokens: 12000,
  });
  if (result.status === "unavailable") {
    if (!isPermanentlyUnavailable(result.reason)) throw new TemporaryAiError(result.reason);
    await store.failSynthesis(job, STUDY_FAILURES.aiDisabled);
    return "failed";
  }
  await store.logUsage(job, "synthesis", result.usage);
  if (result.status === "refused" || result.text.trim() === "") {
    await store.failSynthesis(job, STUDY_FAILURES.refused);
    return "failed";
  }

  await store.saveSynthesis(job, result.text.trim(), documentIds);
  return "ready";
}

export async function generateQuiz(
  store: StudyStore,
  provider: AiProvider,
  userId: string,
  quizId: string,
): Promise<StudyResult> {
  const job = await store.getQuizJob(userId, quizId);
  if (!job || job.status !== "generating") return "skipped";

  const { passages } = await store.getPassages(job, MAX_SOURCE_CHARS);
  if (passages.length === 0) {
    await store.failQuiz(job, STUDY_FAILURES.noContent);
    return "failed";
  }

  const result = await provider.complete({
    feature: "quiz_generation",
    tier: "standard",
    system: quizSystemPrompt(job.cycle),
    messages: [{ role: "user", content: quizUserTurn(passages, job.questionCount) }],
    maxTokens: 8000,
  });
  if (result.status === "unavailable") {
    if (!isPermanentlyUnavailable(result.reason)) throw new TemporaryAiError(result.reason);
    await store.failQuiz(job, STUDY_FAILURES.aiDisabled);
    return "failed";
  }
  await store.logUsage(job, "quiz_generation", result.usage);
  if (result.status === "refused") {
    await store.failQuiz(job, STUDY_FAILURES.refused);
    return "failed";
  }

  const questions = parseGeneratedQuiz(result.text, job.questionCount);
  if (!questions) {
    await store.failQuiz(job, STUDY_FAILURES.invalid);
    return "failed";
  }
  await store.saveQuestions(job, questions, passages);
  return "ready";
}
