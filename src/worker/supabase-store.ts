import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Cycle } from "../config/countries";
import type { SourcePassage } from "../server/ai/types";

import type { IngestDocument, IngestStore } from "./ingest";
import type { StudyJob, StudyStore } from "./study";
import type { SupportStore } from "./support";

/** Client du worker : clé secrète, toujours filtré explicitement sur l'utilisateur. */
export function createWorkerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY manquant");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function supabaseIngestStore(db: SupabaseClient): IngestStore {
  const setStatus = async (doc: IngestDocument, values: Record<string, unknown>) => {
    const { error } = await db.from("documents").update(values).eq("id", doc.id).eq("user_id", doc.userId);
    if (error) throw error;
  };
  return {
    async getDocument(userId, documentId) {
      const { data, error } = await db
        .from("documents")
        .select("id, user_id, chapter_id, storage_path, mime_type, status")
        .eq("id", documentId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        chapterId: data.chapter_id,
        storagePath: data.storage_path,
        mimeType: data.mime_type,
        status: data.status,
      };
    },
    async download(storagePath) {
      const { data, error } = await db.storage.from("documents").download(storagePath);
      if (error) throw error;
      return new Uint8Array(await data.arrayBuffer());
    },
    markProcessing: (doc) => setStatus(doc, { status: "processing", error_message: null }),
    async replaceChunks(doc, chunks) {
      const del = await db.from("document_chunks").delete().eq("document_id", doc.id).eq("user_id", doc.userId);
      if (del.error) throw del.error;
      for (let i = 0; i < chunks.length; i += 200) {
        const rows = chunks.slice(i, i + 200).map((c) => ({
          user_id: doc.userId,
          document_id: doc.id,
          chapter_id: doc.chapterId,
          page: c.page,
          content: c.content,
        }));
        const { error } = await db.from("document_chunks").insert(rows);
        if (error) throw error;
      }
    },
    markReady: (doc, pageCount) => setStatus(doc, { status: "ready", page_count: pageCount }),
    markFailed: (doc, reason) => setStatus(doc, { status: "failed", error_message: reason }),
    async logUsage(doc, feature, usage) {
      const { data: profile } = await db.from("profiles").select("country_code").eq("id", doc.userId).maybeSingle();
      const { error } = await db.from("ai_usage").insert({
        user_id: doc.userId,
        country_code: profile?.country_code ?? null,
        feature,
        model: usage.model,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cache_read_tokens: usage.cacheReadTokens,
      });
      if (error) console.error("[worker] ai_usage", error);
    },
  };
}

export function supabaseStudyStore(db: SupabaseClient): StudyStore {
  const profileOf = async (userId: string) => {
    const { data, error } = await db.from("profiles").select("cycle, country_code").eq("id", userId).single();
    if (error) throw error;
    return { cycle: data.cycle as Cycle, countryCode: data.country_code as string };
  };

  const update = async (table: "syntheses" | "quizzes", job: StudyJob, values: Record<string, unknown>) => {
    const { error } = await db.from(table).update(values).eq("id", job.id).eq("user_id", job.userId);
    if (error) throw error;
  };

  return {
    async getSynthesisJob(userId, synthesisId) {
      const { data, error } = await db
        .from("syntheses")
        .select("id, user_id, module_id, chapter_id, status")
        .eq("id", synthesisId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        moduleId: data.module_id,
        chapterId: data.chapter_id,
        status: data.status,
        ...(await profileOf(userId)),
      };
    },
    async getQuizJob(userId, quizId) {
      const { data, error } = await db
        .from("quizzes")
        .select("id, user_id, module_id, chapter_id, status, question_count")
        .eq("id", quizId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        moduleId: data.module_id,
        chapterId: data.chapter_id,
        status: data.status,
        questionCount: data.question_count,
        ...(await profileOf(userId)),
      };
    },
    async getPassages(job, maxChars) {
      let docs = db
        .from("documents")
        .select("id, title")
        .eq("user_id", job.userId)
        .eq("module_id", job.moduleId)
        .eq("status", "ready")
        .order("created_at");
      if (job.chapterId) docs = docs.eq("chapter_id", job.chapterId);
      const { data: documents, error } = await docs;
      if (error) throw error;

      const passages: SourcePassage[] = [];
      const documentIds: string[] = [];
      let total = 0;
      for (const doc of documents ?? []) {
        const { data: chunks, error: chunkError } = await db
          .from("document_chunks")
          .select("id, page, content")
          .eq("user_id", job.userId)
          .eq("document_id", doc.id)
          .order("id");
        if (chunkError) throw chunkError;
        for (const chunk of chunks ?? []) {
          if (total + chunk.content.length > maxChars) return { passages, documentIds };
          if (!documentIds.includes(doc.id)) documentIds.push(doc.id);
          passages.push({ chunkId: chunk.id, documentTitle: doc.title, page: chunk.page, content: chunk.content });
          total += chunk.content.length;
        }
      }
      return { passages, documentIds };
    },
    saveSynthesis: (job, contentMd, documentIds) =>
      update("syntheses", job, {
        status: "ready",
        content_md: contentMd,
        source_document_ids: documentIds,
        error_message: null,
        updated_at: new Date().toISOString(),
      }),
    failSynthesis: (job, reason) =>
      update("syntheses", job, { status: "failed", error_message: reason, updated_at: new Date().toISOString() }),
    async saveQuestions(job, questions, passages) {
      // Une relance ne crée pas de doublons.
      const del = await db.from("quiz_questions").delete().eq("quiz_id", job.id).eq("user_id", job.userId);
      if (del.error) throw del.error;
      const rows = questions.map((q, index) => ({
        user_id: job.userId,
        quiz_id: job.id,
        position: index + 1,
        kind: "qcm",
        prompt: q.prompt,
        choices: q.choices,
        expected_answer: q.answer,
        explanation: q.explanation,
        source_chunk_ids: passages.filter((p) => q.page !== null && p.page === q.page).map((p) => p.chunkId),
      }));
      const { error } = await db.from("quiz_questions").insert(rows);
      if (error) throw error;
      await update("quizzes", job, { status: "ready", question_count: questions.length, error_message: null });
    },
    failQuiz: (job, reason) => update("quizzes", job, { status: "failed", error_message: reason }),
    async logUsage(job, feature, usage) {
      const { error } = await db.from("ai_usage").insert({
        user_id: job.userId,
        country_code: job.countryCode,
        feature,
        model: usage.model,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cache_read_tokens: usage.cacheReadTokens,
      });
      if (error) console.error("[worker] ai_usage", error);
    },
  };
}

/**
 * Après la lecture d'un document, prépare la synthèse de son chapitre (ou de son
 * module s'il n'a pas de chapitre). Rien si une synthèse est déjà en préparation.
 */
export async function createSynthesisAfterIngest(db: SupabaseClient, userId: string, documentId: string) {
  const { data: doc, error } = await db
    .from("documents")
    .select("module_id, chapter_id")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();
  if (error) throw error;

  let pending = db
    .from("syntheses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("module_id", doc.module_id)
    .eq("status", "generating");
  pending = doc.chapter_id ? pending.eq("chapter_id", doc.chapter_id) : pending.is("chapter_id", null);
  const { count } = await pending;
  if (count) return null;

  const { data, error: insertError } = await db
    .from("syntheses")
    .insert({ user_id: userId, module_id: doc.module_id, chapter_id: doc.chapter_id })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return data.id as string;
}

export function supabaseSupportStore(db: SupabaseClient): SupportStore {
  return {
    async getRequest(requestId) {
      const { data, error } = await db
        .from("support_requests")
        .select("id, user_id, message, created_at, notified_email_at, notified_whatsapp_at")
        .eq("id", requestId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [{ data: profile }, { data: account }] = await Promise.all([
        db.from("profiles").select("username").eq("id", data.user_id).maybeSingle(),
        db.auth.admin.getUserById(data.user_id),
      ]);
      const user = account?.user;
      return {
        id: data.id,
        userId: data.user_id,
        username: profile?.username ?? "inconnu",
        contact: user?.email || (user?.phone ? `+${user.phone.replace(/^\+/, "")}` : null),
        message: data.message,
        createdAt: data.created_at,
        notifiedEmailAt: data.notified_email_at,
        notifiedWhatsappAt: data.notified_whatsapp_at,
      };
    },
    async markNotified(requestId, channel) {
      const column = channel === "email" ? "notified_email_at" : "notified_whatsapp_at";
      const { error } = await db
        .from("support_requests")
        .update({ [column]: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
    },
  };
}
