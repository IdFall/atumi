"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CHALLENGE_DAYS, cleanPlayerName } from "@/lib/challenge";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";
import { computeScore, gradeAnswer } from "@/server/study/quiz";

import { loadChallenge } from "./queries";

export type CreateChallengeResult = { id: string; correct: number; total: number; subject: string } | { error: true };

/**
 * Crée le défi d'un quiz déjà passé par l'élève, ou le relance (même lien,
 * 7 nouveaux jours) s'il était arrêté ou terminé. Un seul défi par quiz.
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
  const expiresAt = new Date(Date.now() + CHALLENGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await service
    .from("quiz_challenges")
    .select("id")
    .eq("quiz_id", quizId)
    .eq("user_id", userId)
    .maybeSingle();
  let id = existing?.id as string | undefined;
  if (id) {
    const { error } = await service
      .from("quiz_challenges")
      .update({ closed_at: null, expires_at: expiresAt })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return { error: true };
  } else {
    const { data, error } = await service
      .from("quiz_challenges")
      .insert({ user_id: userId, quiz_id: quizId, expires_at: expiresAt })
      .select("id")
      .single();
    if (error || !data) return { error: true };
    id = data.id as string;
  }

  const challenge = await loadChallenge(id);
  if (!challenge) return { error: true };
  revalidatePath(`/quiz/${quizId}`);
  return { id, correct: challenge.correct, total: challenge.total, subject: challenge.subject };
}

/** L'élève arrête son défi avant la fin des 7 jours : le lien ne permet plus de jouer. */
export async function closeChallengeAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const challengeId = formData.get("challengeId");
  const quizId = formData.get("quizId");
  if (typeof challengeId !== "string" || !z.uuid().safeParse(challengeId).success) return;
  await createServiceClient()
    .from("quiz_challenges")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", challengeId)
    .eq("user_id", userId);
  if (typeof quizId === "string" && z.uuid().safeParse(quizId).success) revalidatePath(`/quiz/${quizId}`);
}

export interface ChallengeAnswer {
  response: number;
  expected: number;
  isCorrect: boolean;
  explanation: string | null;
}

export interface PlayState {
  error?: "unanswered" | "noName" | "unknown" | "closed";
  result?: { correct: number; total: number; answers: Record<string, ChallengeAnswer> };
}

/**
 * Partie d'un ami, sans compte : correction faite ici ; seuls son prénom et son
 * score sont gardés, pour l'élève qui a lancé le défi. Aucun appel au modèle.
 */
export async function playChallengeAction(_prev: PlayState, formData: FormData): Promise<PlayState> {
  const raw = formData.get("challengeId");
  const challenge = await loadChallenge(typeof raw === "string" ? raw : "");
  if (!challenge) return { error: "unknown" };
  if (!challenge.open) return { error: "closed" };

  const rawName = formData.get("playerName");
  const playerName = cleanPlayerName(typeof rawName === "string" ? rawName : "");
  if (!playerName) return { error: "noName" };

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

  const { error } = await createServiceClient().rpc("record_challenge_play", {
    p_challenge_id: challenge.id,
    p_player_name: playerName,
    p_correct: score.correct,
    p_total: score.total,
  });
  // Arrêté pendant la partie : on ne montre pas la correction.
  if (error?.message.includes("ATUMI_DEFI_TERMINE")) return { error: "closed" };
  return { result: { correct: score.correct, total: score.total, answers } };
}
