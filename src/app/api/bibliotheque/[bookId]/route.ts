import { createUserClient } from "@/lib/supabase/server";
import { getAccess } from "@/server/courses/queries";
import { libraryRights } from "@/server/library/queries";
import { readBookFile } from "@/server/library/source";

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

  const book = await readBookFile(bookId);
  if (!book) return new Response(null, { status: 404 });

  return new Response(book.bytes.slice().buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(book.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
