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
  /** Bonnes réponses de l'auteur du défi ; null pour un défi classe (score du professeur caché). */
  correct: number | null;
  total: number;
  /** Sans les réponses attendues. */
  questions: ChallengeQuestion[];
  /** Défi classe (forfait Enseignant) : correction montrée seulement après publication. */
  classMode: boolean;
  /** Défi classe dont la correction est publiée : réponses attendues par question. */
  correction: ChallengeCorrection[] | null;
}

export interface ChallengeCorrection {
  id: string;
  expected: number;
  explanation: string | null;
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
    .select("id, user_id, quiz_id, expires_at, closed_at, class_mode, correction_published_at")
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
  const classMode = Boolean(challenge.class_mode);
  const published = classMode && challenge.correction_published_at !== null;
  return {
    id: challenge.id,
    // Correction publiée : plus personne ne joue, le lien montre la correction.
    open: !published && isChallengeOpen(challenge, Date.now()),
    username: profile.username,
    subject: chapter?.title ?? mod?.name ?? "",
    correct: classMode ? null : correctFromScore(attempt.score, stored.length),
    total: stored.length,
    questions: stored.map(({ id, prompt, choices }) => ({ id, prompt, choices })),
    classMode,
    correction: published
      ? stored.map((q) => ({ id: q.id, expected: q.expectedAnswer as number, explanation: q.explanation }))
      : null,
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
  classMode: boolean;
  playLimit: number;
  correctionPublishedAt: string | null;
  /** Chapitre ou module du quiz, pour le message WhatsApp de la correction. */
  subject: string;
}

/** Défi d'un quiz de l'élève connecté, avec les parties de ses amis (RLS). */
export async function getMyChallenge(quizId: string): Promise<MyChallenge | null> {
  if (!z.uuid().safeParse(quizId).success) return null;
  const supabase = await createUserClient();
  const [{ data }, { data: quiz }] = await Promise.all([
    supabase
    .from("quiz_challenges")
    .select("id, expires_at, closed_at, class_mode, play_limit, correction_published_at, quiz_challenge_plays(player_name, correct, total, created_at)")
    .eq("quiz_id", quizId)
    .maybeSingle(),
    supabase.from("quizzes").select("modules(name), chapters(title)").eq("id", quizId).maybeSingle(),
  ]);
  if (!data) return null;
  const mod = quiz?.modules as unknown as { name: string } | null;
  const chapter = quiz?.chapters as unknown as { title: string } | null;
  const plays = (data.quiz_challenge_plays ?? [])
    .map((p) => ({ playerName: p.player_name, correct: p.correct, total: p.total, createdAt: p.created_at }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const correctionPublishedAt = data.class_mode ? (data.correction_published_at as string | null) : null;
  return {
    id: data.id,
    open: !correctionPublishedAt && isChallengeOpen(data, Date.now()),
    expiresAt: data.expires_at,
    plays,
    classMode: Boolean(data.class_mode),
    playLimit: data.play_limit ?? 100,
    correctionPublishedAt,
    subject: chapter?.title ?? mod?.name ?? "",
  };
}
