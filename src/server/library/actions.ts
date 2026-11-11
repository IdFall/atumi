"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { MAX_DOCUMENT_BYTES, PDF_MIME } from "@/config/documents";
import { bookImportError, isOwnLibraryPath, LIBRARY_BUCKET } from "@/config/library";
import { createUserClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";
import { registerDocumentAction, type ImportResult } from "@/server/courses/actions";
import { getAccess } from "@/server/courses/queries";

import { libraryRights } from "./queries";
import { readBookFile } from "./source";

export type LibraryErrorKey = "title" | "subscribersOnly" | "full" | "missingFile" | "accessExpired" | "unknown";

export interface LibraryFormState {
  error?: LibraryErrorKey;
  saved?: boolean;
}

function errorKey(message: string): LibraryErrorKey {
  if (message.includes("ATUMI_BIBLIO_ABONNES")) return "subscribersOnly";
  if (message.includes("ATUMI_BIBLIO_ESPACE_PLEIN")) return "full";
  if (message.includes("ATUMI_BIBLIO_FICHIER_ABSENT")) return "missingFile";
  if (message.includes("LULU_ACCES_EXPIRE")) return "accessExpired";
  return "unknown";
}

/**
 * Enregistre un livre déjà déposé par le navigateur dans le bucket. La base
 * vérifie le forfait, lit la taille réelle du fichier et refuse s'il n'y a plus
 * de place ; dans ce cas le fichier est retiré du stockage.
 */
export async function addBookAction(_prev: LibraryFormState, formData: FormData): Promise<LibraryFormState> {
  const userId = await requireUserId();
  const parsed = z
    .object({ title: z.string().trim().min(1).max(200), storagePath: z.string() })
    .safeParse({ title: formData.get("title"), storagePath: formData.get("storagePath") });
  if (!parsed.success) return { error: parsed.error.issues.some((i) => i.path[0] === "title") ? "title" : "unknown" };
  if (!isOwnLibraryPath(parsed.data.storagePath, userId)) return { error: "unknown" };

  const supabase = await createUserClient();
  const { error } = await supabase
    .from("library_books")
    .insert({ user_id: userId, title: parsed.data.title, storage_path: parsed.data.storagePath });
  if (error) {
    await supabase.storage.from(LIBRARY_BUCKET).remove([parsed.data.storagePath]);
    return { error: errorKey(error.message) };
  }
  revalidatePath("/bibliotheque");
  return { saved: true };
}

/** Supprime un livre de l'élève et son fichier (l'espace est libéré). */
export async function deleteBookAction(_prev: LibraryFormState, formData: FormData): Promise<LibraryFormState> {
  await requireUserId();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "unknown" };
  const supabase = await createUserClient();
  const { data } = await supabase.from("library_books").delete().eq("id", id.data).select("storage_path").maybeSingle();
  if (!data) return { error: "unknown" };
  await supabase.storage.from(LIBRARY_BUCKET).remove([data.storage_path]);
  revalidatePath("/bibliotheque");
  return { saved: true };
}

/**
 * Importe un livre de la bibliothèque dans « Mes cours » : le serveur copie le
 * PDF dans le dossier de l'élève (bucket des documents), puis l'import habituel
 * prend le relais (essai, quota d'imports, lecture par le worker). Les gros
 * livres sont refusés (LIBRARY_IMPORT_MAX_PAGES) : l'élève importe un chapitre.
 */
export async function importBookAction(raw: Record<string, string>): Promise<ImportResult> {
  const userId = await requireUserId();
  if (!libraryRights(await getAccess(), false).read) return { ok: false, error: "accessExpired" };

  const book = typeof raw.bookId === "string" ? await readBookFile(raw.bookId) : null;
  if (!book) return { ok: false, error: "unknown" };

  let pages: number;
  try {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(book.bytes.slice());
    pages = pdf.numPages;
  } catch {
    return { ok: false, error: "fileType" };
  }
  const refused = bookImportError(book.bytes.byteLength, pages, MAX_DOCUMENT_BYTES);
  if (refused) return { ok: false, error: refused };

  const storagePath = `${userId}/${crypto.randomUUID()}.pdf`;
  const supabase = await createUserClient();
  const { error } = await supabase.storage
    .from("documents")
    .upload(storagePath, book.bytes, { contentType: PDF_MIME, upsert: false });
  if (error) return { ok: false, error: "uploadFailed" };

  return registerDocumentAction({
    moduleId: raw.moduleId ?? "",
    newModuleName: raw.newModuleName ?? "",
    chapterId: raw.chapterId ?? "",
    newChapterTitle: raw.newChapterTitle ?? "",
    kind: raw.kind ?? "cours",
    fileName: `${book.title.slice(0, 200)}.pdf`,
    storagePath,
    mimeType: PDF_MIME,
    sizeBytes: String(book.bytes.byteLength),
  });
}
