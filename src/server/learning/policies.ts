/**
 * Règles pédagogiques de la V1, indépendantes du fournisseur IA.
 * Elles sont appliquées dans le code, pas seulement dans les consignes du modèle.
 */

const MIN_ATTEMPT_LENGTH = 15;

const NON_ATTEMPTS = [
  "je sais pas",
  "je ne sais pas",
  "jsp",
  "aucune idée",
  "aucune idee",
  "donne la réponse",
  "donne moi la réponse",
  "donne-moi la réponse",
  "la réponse",
  "solution",
  "aide",
  "?",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9?]+/g, " ")
    .trim();
}

/**
 * Une tentative compte si l'apprenant a écrit une démarche, même fausse.
 * Règle provisoire, à affiner avec les retours du pilote.
 */
export function isGenuineAttempt(text: string): boolean {
  const cleaned = normalize(text);
  if (cleaned.length < MIN_ATTEMPT_LENGTH) return false;
  return !NON_ATTEMPTS.some((phrase) => cleaned === normalize(phrase));
}

/**
 * Sur un devoir ou un exercice, la solution n'est donnée qu'après
 * au moins une tentative réelle de l'apprenant (décision V1).
 */
export function canRevealSolution(attempts: readonly string[]): boolean {
  return attempts.some(isGenuineAttempt);
}

export interface TrialRow {
  started_at: string | null;
  ends_at: string | null;
}

export type TrialState =
  | { status: "not_started" }
  | { status: "active"; endsAt: Date }
  | { status: "expired"; endedAt: Date };

export const TRIAL_DURATION_MS = 24 * 60 * 60 * 1000;

/** Essai gratuit d'une journée, qui démarre au premier import (décision V1). */
export function trialState(trial: TrialRow | null, now: Date): TrialState {
  if (!trial || !trial.started_at || !trial.ends_at) return { status: "not_started" };
  const endsAt = new Date(trial.ends_at);
  return now < endsAt ? { status: "active", endsAt } : { status: "expired", endedAt: endsAt };
}

export function startTrial(now: Date): { started_at: string; ends_at: string } {
  return {
    started_at: now.toISOString(),
    ends_at: new Date(now.getTime() + TRIAL_DURATION_MS).toISOString(),
  };
}

export interface AnswerResult {
  isCorrect: boolean;
  answeredAt: Date;
}

export interface Mastery {
  /** Part de bonnes réponses sur les réponses récentes, entre 0 et 1. */
  score: number;
  answeredCount: number;
  /** Fiabilité de l'indicateur selon le nombre de réponses. */
  reliability: "faible" | "moyenne" | "bonne";
}

const MASTERY_WINDOW = 20;

/**
 * Maîtrise d'un chapitre, calculée sur les réponses les plus récentes.
 * Ce n'est jamais une probabilité de réussite à l'examen.
 */
export function chapterMastery(results: readonly AnswerResult[]): Mastery {
  const recent = [...results]
    .sort((a, b) => b.answeredAt.getTime() - a.answeredAt.getTime())
    .slice(0, MASTERY_WINDOW);
  const answeredCount = recent.length;
  const correct = recent.filter((r) => r.isCorrect).length;
  const score = answeredCount === 0 ? 0 : correct / answeredCount;
  const reliability = answeredCount >= 15 ? "bonne" : answeredCount >= 6 ? "moyenne" : "faible";
  return { score, answeredCount, reliability };
}
