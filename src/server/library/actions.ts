"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isOwnLibraryPath, LIBRARY_BUCKET } from "@/config/library";
import { createUserClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";

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
