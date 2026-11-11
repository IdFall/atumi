import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { defaultBook, LIBRARY_BUCKET } from "@/config/library";
import { createUserClient } from "@/lib/supabase/server";

import { getUserBook } from "./queries";

export interface BookFile {
  bytes: Uint8Array;
  title: string;
  /** Nom proposé pour le téléchargement. */
  fileName: string;
}

/**
 * Contenu d'un livre de « Ma bibliothèque » : livre offert (livré avec
 * l'application, dossier `content/bibliotheque`) ou livre de l'élève (lu dans
 * le stockage avec ses droits). Null si le livre n'existe pas pour lui.
 */
export async function readBookFile(bookId: string): Promise<BookFile | null> {
  const offered = defaultBook(bookId);
  if (offered) {
    const file = await readFile(join(process.cwd(), "content", "bibliotheque", offered.file));
    return { bytes: new Uint8Array(file.buffer, file.byteOffset, file.byteLength), title: offered.title, fileName: offered.file };
  }
  const book = /^[0-9a-f-]{36}$/.test(bookId) ? await getUserBook(bookId) : null;
  if (!book) return null;
  const supabase = await createUserClient();
  const { data, error } = await supabase.storage.from(LIBRARY_BUCKET).download(book.storagePath);
  if (error || !data) return null;
  return {
    bytes: new Uint8Array(await data.arrayBuffer()),
    title: book.title,
    fileName: `${book.title.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim() || "livre"}.pdf`,
  };
}
