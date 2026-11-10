"use server";

import { z } from "zod";

import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";
import { computeScore, gradeAnswer } from "@/server/study/quiz";

import { loadChallenge } from "./queries";

export type CreateChallengeResult = { id: string; correct: number; total: number; subject: string } | { error: true };

/**
 * Crée (ou retrouve) le défi d'un quiz déjà passé par l'élève. Un seul défi par
 * quiz : le même lien sert pour tous les amis.
 */
export async function createChallengeAction(quizId: string): Promise<CreateChallengeResult> {
  const userId = await requireUserId();
  if (!z.uuid().safeParse(quizId).success) return { error: true };

  // Le quiz doit être à l'élève et déjà validé (RLS).
  const supabase = await createUserClient();
  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id")
    .eq("quiz_id", quizId)
    .not("submitted_at", "is", null)
    .maybeSingle();
  if (!attempt) return { error: true };

  const service = createServiceClient();
  const { data: existing } = await service
    .from("quiz_challenges")
    .select("id")
    .eq("quiz_id", quizId)
    .eq("user_id", userId)
    .maybeSingle();
  let id = existing?.id as string | undefined;
  if (!id) {
    const { data, error } = await service
      .from("quiz_challenges")
      .insert({ user_id: userId, quiz_id: quizId })
      .select("id")
      .single();
    if (error || !data) return { error: true };
    id = data.id as string;
  }

  const challenge = await loadChallenge(id);
  if (!challenge) return { error: true };
  return { id, correct: challenge.correct, total: challenge.total, subject: challenge.subject };
}

export interface ChallengeAnswer {
  response: number;
  expected: number;
  isCorrect: boolean;
  explanation: string | null;
}

export interface PlayState {
  error?: "unanswered" | "unknown";
  result?: { correct: number; total: number; answers: Record<string, ChallengeAnswer> };
}

/**
 * Partie d'un ami, sans compte : correction faite ici, rien n'est enregistré
 * sauf le nombre de parties jouées. Aucun appel au modèle.
 */
export async function playChallengeAction(_prev: PlayState, formData: FormData): Promise<PlayState> {
  const raw = formData.get("challengeId");
  const challenge = await loadChallenge(typeof raw === "string" ? raw : "");
  if (!challenge) return { error: "unknown" };

  const responses = challenge.stored.map((q) => {
    const value = formData.get(`q-${q.id}`);
    const index = typeof value === "string" && /^[0-3]$/.test(value) ? Number(value) : null;
    return index !== null && index < q.choices.length ? index : null;
  });
  if (responses.some((r) => r === null)) return { error: "unanswered" };

  const answers: Record<string, ChallengeAnswer> = {};
  const results = challenge.stored.map((q, i) => {
    const isCorrect = gradeAnswer({ id: q.id, kind: q.kind, expectedAnswer: q.expectedAnswer }, responses[i]);
    answers[q.id] = { response: responses[i]!, expected: q.expectedAnswer as number, isCorrect, explanation: q.explanation };
    return isCorrect;
  });
  const score = computeScore(results);

  await createServiceClient().rpc("record_challenge_play", { p_challenge_id: challenge.id });
  return { result: { correct: score.correct, total: score.total, answers } };
}
