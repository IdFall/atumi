"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { StudyErrorKey } from "@/i18n/messages";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { contestationReply } from "@/server/ai/tutor";
import { requireUserId } from "@/server/auth/session";
import { enqueue } from "@/server/jobs/client";
import { QUEUES } from "@/server/jobs/queues";

import { computeScore, gradeAnswer, nextMastery } from "./quiz";

export interface StudyFormState {
  error?: StudyErrorKey;
}

/** Nombre de questions quand le forfait ne fixe pas de limite. */
const DEFAULT_QUESTION_COUNT = 10;

const scopeSchema = z.object({ moduleId: z.uuid(), chapterId: z.union([z.uuid(), z.literal("")]) });

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Vérifie, avec le client de l'utilisateur (RLS), que le module et le chapitre lui appartiennent. */
async function ownedScope(formData: FormData) {
  const parsed = scopeSchema.safeParse({ moduleId: field(formData, "moduleId"), chapterId: field(formData, "chapterId") });
  if (!parsed.success) return null;
  const { moduleId } = parsed.data;
  const chapterId = parsed.data.chapterId || null;

  const supabase = await createUserClient();
  const { data: mod } = await supabase.from("modules").select("id").eq("id", moduleId).maybeSingle();
  if (!mod) return null;
  if (chapterId) {
    const { data } = await supabase.from("chapters").select("id").eq("id", chapterId).eq("module_id", moduleId).maybeSingle();
    if (!data) return null;
  }

  let docs = supabase.from("documents").select("id", { count: "exact", head: true }).eq("module_id", moduleId).eq("status", "ready");
  if (chapterId) docs = docs.eq("chapter_id", chapterId);
  const { count } = await docs;
  return { moduleId, chapterId, readyDocuments: count ?? 0 };
}

function quotaError(message: string): StudyErrorKey {
  if (message.includes("LULU_ACCES_EXPIRE")) return "accessExpired";
  if (message.includes("LULU_QUOTA_QUIZ_ATTEINT")) return "quotaReached";
  return "unknown";
}

/** Prépare (ou met à jour) la synthèse d'un chapitre, ou du module entier. */
export async function requestSynthesisAction(_prev: StudyFormState, formData: FormData): Promise<StudyFormState> {
  const userId = await requireUserId();
  const scope = await ownedScope(formData);
  if (!scope) return { error: "unknown" };
  if (scope.readyDocuments === 0) return { error: "noDocument" };

  const service = createServiceClient();
  let pending = service
    .from("syntheses")
    .select("id, updated_at")
    .eq("user_id", userId)
    .eq("module_id", scope.moduleId)
    .eq("status", "generating");
  pending = scope.chapterId ? pending.eq("chapter_id", scope.chapterId) : pending.is("chapter_id", null);
  const { data: running } = await pending;
  if ((running ?? []).some((s) => Date.now() - Date.parse(s.updated_at) < 15 * 60 * 1000)) return { error: "busy" };

  // Écriture calculée : la synthèse n'est écrite que par le serveur.
  const { data, error } = await service
    .from("syntheses")
    .insert({ user_id: userId, module_id: scope.moduleId, chapter_id: scope.chapterId })
    .select("id")
    .single();
  if (error) return { error: "unknown" };
  await enqueue(QUEUES.synthesisGenerate, { userId, synthesisId: data.id });

  revalidatePath(`/cours/${scope.moduleId}/synthese`);
  return {};
}

/** Crée un quiz « en préparation » : la base vérifie le quota avant tout appel au modèle. */
export async function startQuizAction(_prev: StudyFormState, formData: FormData): Promise<StudyFormState> {
  const userId = await requireUserId();
  const scope = await ownedScope(formData);
  if (!scope) return { error: "unknown" };
  if (scope.readyDocuments === 0) return { error: "noDocument" };

  const supabase = await createUserClient();
  const { data: usage } = await supabase.rpc("plan_usage");
  const limit = (usage as { quiz_question_limit: number | null }[] | null)?.[0]?.quiz_question_limit;
  const questionCount = limit ?? DEFAULT_QUESTION_COUNT;

  const service = createServiceClient();
  const { data, error } = await service
    .from("quizzes")
    .insert({ user_id: userId, module_id: scope.moduleId, chapter_id: scope.chapterId, question_count: questionCount })
    .select("id")
    .single();
  if (error) return { error: quotaError(error.message) };

  try {
    await enqueue(QUEUES.quizGenerate, { userId, quizId: data.id });
  } catch (cause) {
    console.error("quiz-generate : dépôt impossible", { quizId: data.id, cause });
    await service.from("quizzes").update({ status: "failed" }).eq("id", data.id).eq("user_id", userId);
    return { error: "unknown" };
  }

  revalidatePath(`/cours/${scope.moduleId}/synthese`);
  redirect(`/quiz/${data.id}`);
}

export interface SubmitState {
  error?: "unanswered" | "unknown";
}

/** Corrige le quiz côté serveur (les réponses attendues ne quittent jamais le serveur avant validation). */
export async function submitQuizAction(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const userId = await requireUserId();
  const quizId = field(formData, "quizId");
  if (!z.uuid().safeParse(quizId).success) return { error: "unknown" };

  const service = createServiceClient();
  const { data: quiz } = await service
    .from("quizzes")
    .select("id, chapter_id, status")
    .eq("id", quizId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!quiz || quiz.status !== "ready") return { error: "unknown" };

  const { data: questions } = await service
    .from("quiz_questions")
    .select("id, kind, choices, expected_answer")
    .eq("quiz_id", quizId)
    .eq("user_id", userId);
  if (!questions?.length) return { error: "unknown" };

  const responses = questions.map((q) => {
    const raw = field(formData, `q-${q.id}`);
    const index = /^[0-3]$/.test(raw) ? Number(raw) : null;
    return { question: q, response: index !== null && index < (q.choices?.length ?? 0) ? index : null };
  });
  if (responses.some((r) => r.response === null)) return { error: "unanswered" };

  const results = responses.map((r) =>
    gradeAnswer({ id: r.question.id, kind: r.question.kind, expectedAnswer: r.question.expected_answer }, r.response),
  );
  const score = computeScore(results);

  // Un seul passage par quiz (contrainte unique en base).
  const { data: attempt, error } = await service
    .from("quiz_attempts")
    .insert({ user_id: userId, quiz_id: quizId, submitted_at: new Date().toISOString(), score: score.correct / score.total })
    .select("id")
    .single();
  if (error) {
    redirect(`/quiz/${quizId}`);
  }

  const { error: answersError } = await service.from("quiz_answers").insert(
    responses.map((r, i) => ({
      user_id: userId,
      attempt_id: attempt.id,
      question_id: r.question.id,
      response: r.response,
      is_correct: results[i],
    })),
  );
  if (answersError) {
    await service.from("quiz_attempts").delete().eq("id", attempt.id).eq("user_id", userId);
    return { error: "unknown" };
  }

  if (quiz.chapter_id) {
    const { data: previous } = await service
      .from("chapter_mastery")
      .select("mastery, answered_count")
      .eq("user_id", userId)
      .eq("chapter_id", quiz.chapter_id)
      .maybeSingle();
    const next = nextMastery(
      previous ? { mastery: Number(previous.mastery), answeredCount: previous.answered_count } : null,
      score,
    );
    await service.from("chapter_mastery").upsert({
      user_id: userId,
      chapter_id: quiz.chapter_id,
      mastery: next.mastery,
      answered_count: next.answeredCount,
      updated_at: new Date().toISOString(),
    });
  }

  revalidatePath(`/quiz/${quizId}`);
  redirect(`/quiz/${quizId}`);
}

export interface ContestState {
  reply?: string;
  error?: boolean;
}

/** Contestation : enregistrée, réponse fixe, aucun appel au modèle ni débat (décision V1). */
export async function contestAnswerAction(_prev: ContestState, formData: FormData): Promise<ContestState> {
  const userId = await requireUserId();
  const answerId = field(formData, "answerId");
  const reason = field(formData, "reason").trim().slice(0, 1000);
  if (!z.uuid().safeParse(answerId).success) return { error: true };

  const supabase = await createUserClient();
  // La clé étrangère (answer_id, user_id) refuse la réponse d'un autre utilisateur.
  const { error } = await supabase.from("contestations").insert({ user_id: userId, answer_id: answerId, reason: reason || null });
  if (error) return { error: true };
  return { reply: contestationReply() };
}
