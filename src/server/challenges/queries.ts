import "server-only";

import { z } from "zod";

import { correctFromScore, isChallengeOpen } from "@/lib/challenge";
import { firstNameOf } from "@/server/auth/schemas";
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
  /**
   * Quiz d'entraînement partagé par un compte enseignant sans le forfait
   * Enseignant : le score du professeur n'est jamais montré ni comparé ;
   * l'élève voit sa note et la correction tout de suite.
   */
  practice: boolean;
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
    service.from("profiles").select("username, full_name, role").eq("id", userId).maybeSingle(),
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
  // Un professeur ne se mesure pas à ses élèves : son score reste caché.
  const practice = !classMode && profile.role === "enseignant";
  const published = classMode && challenge.correction_published_at !== null;
  return {
    id: challenge.id,
    // Correction publiée : plus personne ne joue, le lien montre la correction.
    open: !published && isChallengeOpen(challenge, Date.now()),
    // Lien public : le prénom seulement (jamais le nom de famille).
    username: profile.full_name ? firstNameOf(profile.full_name) : profile.username,
    subject: chapter?.title ?? mod?.name ?? "",
    correct: classMode || practice ? null : correctFromScore(attempt.score, stored.length),
    total: stored.length,
    questions: stored.map(({ id, prompt, choices }) => ({ id, prompt, choices })),
    classMode,
    practice,
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

export interface MyQuizItem {
  id: string;
  subject: string;
  createdAt: string;
  status: "generating" | "ready" | "failed";
  /** Note de l'élève, une fois le quiz passé. */
  result: { correct: number; total: number } | null;
  challenge: {
    id: string;
    open: boolean;
    expiresAt: string;
    classMode: boolean;
    correctionPublished: boolean;
    plays: number;
  } | null;
}

/** Tous les quiz de l'utilisateur connecté (RLS), du plus récent au plus ancien, avec leur défi. */
export async function listMyQuizzes(): Promise<MyQuizItem[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select(
      "id, status, created_at, modules(name), chapters(title), quiz_attempts(submitted_at, quiz_answers(is_correct)), quiz_challenges(id, expires_at, closed_at, class_mode, correction_published_at, quiz_challenge_plays(id))",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const now = Date.now();
  return (data ?? []).map((q) => {
    const mod = q.modules as unknown as { name: string } | null;
    const chapter = q.chapters as unknown as { title: string } | null;
    const attempts = (q.quiz_attempts ?? []) as unknown as { submitted_at: string | null; quiz_answers: { is_correct: boolean | null }[] }[];
    const attempt = attempts.find((a) => a.submitted_at);
    const answers = attempt?.quiz_answers ?? [];
    const challenges = (q.quiz_challenges ?? []) as unknown as {
      id: string;
      expires_at: string;
      closed_at: string | null;
      class_mode: boolean;
      correction_published_at: string | null;
      quiz_challenge_plays: { id: string }[] | null;
    }[];
    const c = challenges[0];
    const published = Boolean(c?.class_mode && c.correction_published_at);
    return {
      id: q.id,
      subject: chapter?.title ?? mod?.name ?? "",
      createdAt: q.created_at,
      // Une préparation bloquée plus de 15 min a été abandonnée par le worker.
      status: (q.status === "generating" && now - Date.parse(q.created_at) > 15 * 60 * 1000 ? "failed" : q.status) as MyQuizItem["status"],
      result: attempt ? { correct: answers.filter((a) => a.is_correct === true).length, total: answers.length } : null,
      challenge: c
        ? {
            id: c.id,
            open: !published && isChallengeOpen(c, now),
            expiresAt: c.expires_at,
            classMode: Boolean(c.class_mode),
            correctionPublished: published,
            plays: c.quiz_challenge_plays?.length ?? 0,
          }
        : null,
    };
  });
}
