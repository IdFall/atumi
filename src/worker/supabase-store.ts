import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { IngestDocument, IngestStore } from "./ingest";

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
  };
}
