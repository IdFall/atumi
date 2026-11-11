import { DEFAULT_BOOKS, type DefaultBook } from "@/config/library";
import { createUserClient } from "@/lib/supabase/server";
import { getAccess, type Access } from "@/server/courses/queries";

export interface UserBook {
  id: string;
  title: string;
  sizeBytes: number;
  createdAt: string;
  storagePath: string;
}

/** Ce que l'élève peut faire dans sa bibliothèque, selon son accès. */
export interface LibraryRights {
  /** Lire les livres (offerts et les siens). */
  read: boolean;
  /** Télécharger et ajouter : abonnés seulement. */
  download: boolean;
  upload: boolean;
}

export function libraryRights(access: Access, uploadAllowed: boolean): LibraryRights {
  const reader = access.state === "trial" || access.state === "trialNotStarted" || access.state === "subscribed";
  const subscribed = access.state === "subscribed";
  return { read: reader, download: subscribed, upload: subscribed && uploadAllowed };
}

export interface Library {
  access: Access;
  rights: LibraryRights;
  /** Espace du forfait en octets ; null = sans limite. */
  bytesLimit: number | null;
  usedBytes: number;
  defaults: readonly DefaultBook[];
  books: UserBook[];
}

export async function getLibrary(): Promise<Library> {
  const supabase = await createUserClient();
  const [access, quota, allowed, books] = await Promise.all([
    getAccess(),
    supabase.rpc("library_quota").maybeSingle<{ bytes_limit: number | null; used: number }>(),
    supabase.rpc("library_upload_allowed"),
    supabase.from("library_books").select("id, title, size_bytes, created_at, storage_path").order("created_at", { ascending: false }),
  ]);
  return {
    access,
    rights: libraryRights(access, allowed.data === true),
    bytesLimit: quota.data ? quota.data.bytes_limit : 0,
    usedBytes: Number(quota.data?.used ?? 0),
    defaults: DEFAULT_BOOKS,
    books: (books.data ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      sizeBytes: Number(b.size_bytes),
      createdAt: b.created_at,
      storagePath: b.storage_path,
    })),
  };
}

/** Livre de l'élève (vérifié par RLS), ou null. */
export async function getUserBook(id: string): Promise<UserBook | null> {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from("library_books")
    .select("id, title, size_bytes, created_at, storage_path")
    .eq("id", id)
    .maybeSingle();
  return data
    ? { id: data.id, title: data.title, sizeBytes: Number(data.size_bytes), createdAt: data.created_at, storagePath: data.storage_path }
    : null;
}
