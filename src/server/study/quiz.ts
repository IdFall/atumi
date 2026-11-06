/**
 * Quiz : lecture de la réponse du modèle, correction et score.
 * Sans dépendance à Next ni à la base : utilisé par le worker et les Server Actions.
 */
import { z } from "zod";

export interface GeneratedQuestion {
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
  page: number | null;
}

const questionSchema = z.object({
  prompt: z.string().trim().min(3).max(1000),
  choices: z.array(z.string().trim().min(1).max(300)).length(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().trim().max(1500).default(""),
  page: z.number().int().positive().nullable().catch(null),
});

/** Nombre minimal de questions valides pour qu'un quiz soit proposé. */
export const MIN_QUESTIONS = 3;

/**
 * Garde les questions bien formées (quatre propositions distinctes, une bonne
 * réponse), dans la limite demandée. Renvoie null si le modèle n'a pas produit
 * assez de questions exploitables.
 */
export function parseGeneratedQuiz(text: string, questionCount: number): GeneratedQuestion[] | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const list = (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return null;

  const questions: GeneratedQuestion[] = [];
  for (const item of list) {
    const parsed = questionSchema.safeParse(item);
    if (!parsed.success) continue;
    const distinct = new Set(parsed.data.choices.map((c) => c.toLowerCase()));
    if (distinct.size !== 4) continue;
    questions.push(parsed.data);
    if (questions.length === questionCount) break;
  }
  return questions.length >= Math.min(MIN_QUESTIONS, questionCount) ? questions : null;
}

export interface StoredQuestion {
  id: string;
  kind: "qcm" | "courte";
  expectedAnswer: unknown;
}

/** Correction d'un QCM : la réponse attendue est l'indice de la bonne proposition. */
export function gradeAnswer(question: StoredQuestion, response: number | null): boolean {
  if (question.kind !== "qcm" || response === null) return false;
  return question.expectedAnswer === response;
}

export interface Score {
  correct: number;
  total: number;
  /** Pourcentage arrondi à l'unité. */
  percent: number;
}

export function computeScore(results: readonly boolean[]): Score {
  const correct = results.filter(Boolean).length;
  const total = results.length;
  return { correct, total, percent: total === 0 ? 0 : Math.round((correct / total) * 100) };
}

/** Maîtrise cumulée d'un chapitre : moyenne de toutes les réponses données. */
export function nextMastery(previous: { mastery: number; answeredCount: number } | null, score: Score) {
  const before = previous ?? { mastery: 0, answeredCount: 0 };
  const answeredCount = before.answeredCount + score.total;
  const mastery = answeredCount === 0 ? 0 : (before.mastery * before.answeredCount + score.correct) / answeredCount;
  return { mastery: Math.round(mastery * 10000) / 10000, answeredCount };
}
