import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { defaultBook, LIBRARY_BUCKET } from "@/config/library";
import { createUserClient } from "@/lib/supabase/server";
import { getAccess } from "@/server/courses/queries";
import { getUserBook, libraryRights } from "@/server/library/queries";

/**
 * Fichier d'un livre de « Ma bibliothèque », lu par le serveur : pas de lien
 * direct vers le stockage. Lecture pour tout accès en cours (essai compris) ;
 * `?telecharger=1` (fichier joint) seulement pour les abonnés.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/bibliotheque/[bookId]">) {
  const { bookId } = await params;
  const supabase = await createUserClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new Response(null, { status: 401 });

  const rights = libraryRights(await getAccess(), false);
  const download = new URL(request.url).searchParams.get("telecharger") === "1";
  if (!rights.read || (download && !rights.download)) return new Response(null, { status: 403 });

  let bytes: ArrayBuffer;
  let fileName: string;
  const offered = defaultBook(bookId);
  if (offered) {
    const file = await readFile(join(process.cwd(), "content", "bibliotheque", offered.file));
    bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    fileName = offered.file;
  } else {
    const book = /^[0-9a-f-]{36}$/.test(bookId) ? await getUserBook(bookId) : null;
    if (!book) return new Response(null, { status: 404 });
    const { data, error } = await supabase.storage.from(LIBRARY_BUCKET).download(book.storagePath);
    if (error || !data) return new Response(null, { status: 404 });
    bytes = await data.arrayBuffer();
    fileName = `${book.title.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim() || "livre"}.pdf`;
  }

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
