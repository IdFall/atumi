import "server-only";

import { z } from "zod";

import { correctFromScore, isChallengeOpen } from "@/lib/challenge";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";

export interface ChallengeQuestion {
  id: string;
  prompt: string;
  choices: string[];
}

export interface PublicChallenge {
  id: string;
  /** Faux une fois le défi arrêté par l'élève ou ses 7 jours passés. */
  open: boolean;
  username: string;
  subject: string;
  /** Bonnes réponses de l'élève qui a lancé le défi. */
  correct: number;
  total: number;
  /** Sans les réponses attendues. */
  questions: ChallengeQuestion[];
}

interface StoredChallengeQuestion extends ChallengeQuestion {
  kind: "qcm" | "courte";
  expectedAnswer: unknown;
  explanation: string | null;
}

/**
 * Lecture serveur d'un défi (page publique, sans compte) : la clé secrète est
 * nécessaire, toujours filtrée sur l'auteur du défi. Rien d'autre que le défi
 * lui-même ne sort : questions, pseudo, matière et score.
 */
export async function loadChallenge(challengeId: string): Promise<(PublicChallenge & { stored: StoredChallengeQuestion[] }) | null> {
  if (!z.uuid().safeParse(challengeId).success) return null;
  const service = createServiceClient();
  const { data: challenge } = await service
    .from("quiz_challenges")
    .select("id, user_id, quiz_id, expires_at, closed_at")
    .eq("id", challengeId)
    .maybeSingle();
  if (!challenge) return null;

  const userId = challenge.user_id as string;
  const [{ data: quiz }, { data: profile }, { data: questions }, { data: attempt }] = await Promise.all([
    service
      .from("quizzes")
      .select("status, modules(name), chapters(title)")
      .eq("id", challenge.quiz_id)
      .eq("user_id", userId)
      .maybeSingle(),
    service.from("profiles").select("username").eq("id", userId).maybeSingle(),
    service
      .from("quiz_questions")
      .select("id, kind, prompt, choices, expected_answer, explanation")
      .eq("quiz_id", challenge.quiz_id)
      .eq("user_id", userId)
      .order("position"),
    service
      .from("quiz_attempts")
      .select("score")
      .eq("quiz_id", challenge.quiz_id)
      .eq("user_id", userId)
      .not("submitted_at", "is", null)
      .maybeSingle(),
  ]);
  if (!quiz || quiz.status !== "ready" || !profile || !questions?.length || !attempt) return null;

  const mod = quiz.modules as unknown as { name: string } | null;
  const chapter = quiz.chapters as unknown as { title: string } | null;
  const stored: StoredChallengeQuestion[] = questions.map((q) => ({
    id: q.id,
    kind: q.kind,
    prompt: q.prompt,
    choices: q.choices ?? [],
    expectedAnswer: q.expected_answer,
    explanation: q.explanation,
  }));
  return {
    id: challenge.id,
    open: isChallengeOpen(challenge, Date.now()),
    username: profile.username,
    subject: chapter?.title ?? mod?.name ?? "",
    correct: correctFromScore(attempt.score, stored.length),
    total: stored.length,
    questions: stored.map(({ id, prompt, choices }) => ({ id, prompt, choices })),
    stored,
  };
}

/** Version publique : sans les réponses attendues. */
export async function getPublicChallenge(challengeId: string): Promise<PublicChallenge | null> {
  const challenge = await loadChallenge(challengeId);
  if (!challenge) return null;
  const { stored: _stored, ...rest } = challenge;
  void _stored;
  return rest;
}

export interface ChallengePlayView {
  playerName: string;
  correct: number;
  total: number;
  createdAt: string;
}

export interface MyChallenge {
  id: string;
  open: boolean;
  expiresAt: string;
  plays: ChallengePlayView[];
}

/** Défi d'un quiz de l'élève connecté, avec les parties de ses amis (RLS). */
export async function getMyChallenge(quizId: string): Promise<MyChallenge | null> {
  if (!z.uuid().safeParse(quizId).success) return null;
  const supabase = await createUserClient();
  const { data } = await supabase
    .from("quiz_challenges")
    .select("id, expires_at, closed_at, quiz_challenge_plays(player_name, correct, total, created_at)")
    .eq("quiz_id", quizId)
    .maybeSingle();
  if (!data) return null;
  const plays = (data.quiz_challenge_plays ?? [])
    .map((p) => ({ playerName: p.player_name, correct: p.correct, total: p.total, createdAt: p.created_at }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { id: data.id, open: isChallengeOpen(data, Date.now()), expiresAt: data.expires_at, plays };
}
