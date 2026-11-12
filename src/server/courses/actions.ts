"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isImageMime } from "@/config/documents";
import type { CoursesErrorKey, ImportErrorKey } from "@/i18n/messages";
import { serverEnv } from "@/lib/env";
import { createUserClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";
import { enqueue } from "@/server/jobs/client";
import { QUEUES } from "@/server/jobs/queues";

import { parseChapterTitle, parseImport, parseModuleName } from "./schemas";

export interface CoursesFormState {
  error?: CoursesErrorKey;
  /** Modification enregistrée (formulaire « Modifier »). */
  saved?: boolean;
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createModuleAction(_prev: CoursesFormState, formData: FormData): Promise<CoursesFormState> {
  const userId = await requireUserId();
  const parsed = parseModuleName(field(formData, "name"));
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("modules")
    .insert({ user_id: userId, name: parsed.name })
    .select("id")
    .single();
  if (error) return { error: "unknown" };

  revalidatePath("/cours");
  redirect(`/cours/${data.id}`);
}

export async function createChapterAction(_prev: CoursesFormState, formData: FormData): Promise<CoursesFormState> {
  const userId = await requireUserId();
  const moduleId = field(formData, "moduleId");
  if (!z.uuid().safeParse(moduleId).success) return { error: "unknown" };
  const parsed = parseChapterTitle(field(formData, "title"));
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createUserClient();
  // La clé étrangère (module_id, user_id) refuse le module d'un autre utilisateur.
  const { error } = await supabase
    .from("chapters")
    .insert({ user_id: userId, module_id: moduleId, title: parsed.title, position: await nextPosition(moduleId) });
  if (error) return { error: "unknown" };

  revalidatePath(`/cours/${moduleId}`);
  revalidatePath("/cours");
  return {};
}

async function nextPosition(moduleId: string): Promise<number> {
  const supabase = await createUserClient();
  const { count } = await supabase
    .from("chapters")
    .select("id", { count: "exact", head: true })
    .eq("module_id", moduleId);
  return count ?? 0;
}

export type ImportResult = { ok: true; moduleId: string } | { ok: false; error: ImportErrorKey };

/**
 * Enregistre un document déjà déposé par le navigateur dans le bucket privé,
 * puis confie sa lecture au worker. La base démarre l'essai au premier import
 * et refuse l'import sans droit (LULU_ACCES_EXPIRE).
 */
export async function registerDocumentAction(raw: Record<string, string>): Promise<ImportResult> {
  const userId = await requireUserId();
  const parsed = parseImport(raw, userId);
  const supabase = await createUserClient();
  const bucket = supabase.storage.from("documents");

  const discardUpload = async () => {
    if (typeof raw.storagePath === "string" && raw.storagePath.startsWith(`${userId}/`)) {
      await bucket.remove([raw.storagePath]);
    }
  };

  if (!parsed.ok) {
    await discardUpload();
    return parsed;
  }
  const input = parsed.data;

  // Sans service d'IA, une photo ne peut pas être lue : on la refuse avant l'import.
  if (isImageMime(input.mimeType) && !photosEnabled()) {
    await discardUpload();
    return { ok: false, error: "photosUnavailable" };
  }

  const { data: uploaded } = await bucket.exists(input.storagePath);
  if (!uploaded) return { ok: false, error: "uploadFailed" };

  let moduleId: string;
  let createdModule = false;
  let createdChapter: string | null = null;
  if ("id" in input.module) {
    moduleId = input.module.id;
  } else {
    const { data, error } = await supabase
      .from("modules")
      .insert({ user_id: userId, name: input.module.name })
      .select("id")
      .single();
    if (error) {
      await discardUpload();
      return { ok: false, error: "unknown" };
    }
    moduleId = data.id;
    createdModule = true;
  }

  let chapterId: string | null = null;
  if (input.chapter && "id" in input.chapter) {
    chapterId = input.chapter.id;
  } else if (input.chapter) {
    const { data, error } = await supabase
      .from("chapters")
      .insert({ user_id: userId, module_id: moduleId, title: input.chapter.title, position: await nextPosition(moduleId) })
      .select("id")
      .single();
    if (error) {
      await discardUpload();
      return { ok: false, error: "unknown" };
    }
    chapterId = data.id;
    createdChapter = data.id;
  }

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      module_id: moduleId,
      chapter_id: chapterId,
      kind: input.kind,
      title: input.title,
      storage_path: input.storagePath,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
    })
    .select("id")
    .single();
  if (error) {
    await discardUpload();
    // Pas de module ou de chapitre vide laissé derrière un import refusé.
    if (createdModule) await supabase.from("modules").delete().eq("id", moduleId);
    else if (createdChapter) await supabase.from("chapters").delete().eq("id", createdChapter);
    return { ok: false, error: importError(error.message) };
  }

  // Si la file est indisponible, le document reste « en attente » et pourra être relancé.
  try {
    await enqueue(QUEUES.documentIngest, { userId, documentId: doc.id });
  } catch (cause) {
    console.error("document-ingest : dépôt impossible", { documentId: doc.id, cause });
  }

  revalidatePath("/cours");
  revalidatePath(`/cours/${moduleId}`);
  revalidatePath("/tableau-de-bord");
  return { ok: true, moduleId };
}

function importError(message: string): ImportErrorKey {
  if (message.includes("LULU_ACCES_EXPIRE")) return "accessExpired";
  if (message.includes("LULU_QUOTA_IMPORT_ATTEINT")) return "importLimit";
  if (message.includes("ATUMI_ESPACE_PLEIN")) return "storageFull";
  return "unknown";
}

/** Les photos sont lues par le modèle : elles ne sont acceptées que si le service d'IA est configuré. */
function photosEnabled(): boolean {
  return Boolean(serverEnv().ANTHROPIC_API_KEY);
}
