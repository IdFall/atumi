import "server-only";

import { z } from "zod";

import { createServiceClient, createUserClient } from "@/lib/supabase/server";

/** Une préparation bloquée plus longtemps est considérée comme échouée (le worker a abandonné). */
const STALE_AFTER_MS = 15 * 60 * 1000;

export type GenerationStatus = "generating" | "ready" | "failed";

export interface QuizQuota {
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface StudyPage {
  moduleId: string;
  moduleName: string;
  chapter: { id: string; title: string } | null;
  readyDocuments: number;
  pendingDocuments: number;
  synthesis: { status: GenerationStatus; contentMd: string; errorMessage: string | null; outdated: boolean } | null;
  /** null : aucun droit en cours (essai terminé ou pas encore commencé). */
  quizQuota: QuizQuota | null;
}

const isUuid = (value: string) => z.uuid().safeParse(value).success;

function effectiveStatus(status: GenerationStatus, since: string): GenerationStatus {
  return status === "generating" && Date.now() - Date.parse(since) > STALE_AFTER_MS ? "failed" : status;
}

export async function getStudyPage(moduleId: string, chapterId: string | null): Promise<StudyPage | null> {
  if (!isUuid(moduleId) || (chapterId !== null && !isUuid(chapterId))) return null;
  const supabase = await createUserClient();

  const { data: mod } = await supabase.from("modules").select("id, name").eq("id", moduleId).maybeSingle();
  if (!mod) return null;

  let chapter: StudyPage["chapter"] = null;
  if (chapterId) {
    const { data } = await supabase
      .from("chapters")
      .select("id, title")
      .eq("id", chapterId)
      .eq("module_id", moduleId)
      .maybeSingle();
    if (!data) return null;
    chapter = { id: data.id, title: data.title };
  }

  let docs = supabase.from("documents").select("id, status").eq("module_id", moduleId);
  if (chapterId) docs = docs.eq("chapter_id", chapterId);
  let syn = supabase
    .from("syntheses")
    .select("status, content_md, error_message, source_document_ids, updated_at")
    .eq("module_id", moduleId)
    .order("created_at", { ascending: false })
    .limit(1);
  syn = chapterId ? syn.eq("chapter_id", chapterId) : syn.is("chapter_id", null);

  const [{ data: documents }, { data: syntheses }, { data: quota }] = await Promise.all([docs, syn, supabase.rpc("quiz_quota")]);

  const ready = (documents ?? []).filter((d) => d.status === "ready");
  const latest = syntheses?.[0];
  const quotaRow = (quota as { quiz_limit: number | null; used: number; remaining: number | null }[] | null)?.[0];

  return {
    moduleId: mod.id,
    moduleName: mod.name,
    chapter,
    readyDocuments: ready.length,
    pendingDocuments: (documents ?? []).filter((d) => d.status === "uploaded" || d.status === "processing").length,
    synthesis: latest
      ? {
          status: effectiveStatus(latest.status, latest.updated_at),
          contentMd: latest.content_md,
          errorMessage: latest.error_message,
          outdated: latest.status === "ready" && ready.some((d) => !latest.source_document_ids.includes(d.id)),
        }
      : null,
    quizQuota: quotaRow ? { limit: quotaRow.quiz_limit, used: quotaRow.used, remaining: quotaRow.remaining } : null,
  };
}

export interface QuizQuestionView {
  id: string;
  position: number;
  prompt: string;
  choices: string[];
}

export interface QuizAnswerView {
  answerId: string;
  response: number | null;
  isCorrect: boolean;
  expected: number;
  explanation: string | null;
  contested: boolean;
}

export interface QuizView {
  id: string;
  moduleId: string;
  chapterId: string | null;
  status: GenerationStatus;
  errorMessage: string | null;
  questions: QuizQuestionView[];
  /** Présent une fois le quiz validé : correction question par question. */
  correction: { answers: Record<string, QuizAnswerView>; correct: number; total: number } | null;
}

export async function getQuizView(quizId: string): Promise<QuizView | null> {
  if (!isUuid(quizId)) return null;
  const supabase = await createUserClient();
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, user_id, module_id, chapter_id, status, error_message, created_at")
    .eq("id", quizId)
    .maybeSingle();
  if (!quiz) return null;

  const view: QuizView = {
    id: quiz.id,
    moduleId: quiz.module_id,
    chapterId: quiz.chapter_id,
    status: effectiveStatus(quiz.status, quiz.created_at),
    errorMessage: quiz.error_message,
    questions: [],
    correction: null,
  };
  if (view.status !== "ready") return view;

  // Les questions ne sont pas lisibles par le client (réponses attendues) :
  // lecture serveur, filtrée sur l'utilisateur connecté, réponses retirées.
  const service = createServiceClient();
  const { data: questions, error } = await service
    .from("quiz_questions")
    .select("id, position, prompt, choices, expected_answer, explanation")
    .eq("quiz_id", quiz.id)
    .eq("user_id", quiz.user_id)
    .order("position");
  if (error) throw error;
  view.questions = (questions ?? []).map((q) => ({ id: q.id, position: q.position, prompt: q.prompt, choices: q.choices ?? [] }));

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, submitted_at, quiz_answers(id, question_id, response, is_correct, contestations(id))")
    .eq("quiz_id", quiz.id)
    .not("submitted_at", "is", null)
    .maybeSingle();
  if (!attempt) return view;

  const answers: Record<string, QuizAnswerView> = {};
  for (const a of attempt.quiz_answers ?? []) {
    const q = questions?.find((x) => x.id === a.question_id);
    if (!q) continue;
    answers[q.id] = {
      answerId: a.id,
      response: typeof a.response === "number" ? a.response : null,
      isCorrect: a.is_correct === true,
      expected: q.expected_answer as number,
      explanation: q.explanation,
      contested: (a.contestations ?? []).length > 0,
    };
  }
  const values = Object.values(answers);
  view.correction = { answers, correct: values.filter((a) => a.isCorrect).length, total: view.questions.length };
  return view;
}
