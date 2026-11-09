"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createUserClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";

import type { CoursesFormState } from "./actions";
import { parseChapterTitle, parseModuleName } from "./schemas";

/**
 * Modifier et supprimer modules, chapitres et documents (client utilisateur : RLS).
 * Une suppression ne redonne rien au forfait : la base garde la trace de ce qui
 * a été compté (`quota_consumptions`).
 */

export type ManagedItem = "module" | "chapter" | "document";

const itemSchema = z.object({
  kind: z.enum(["module", "chapter", "document"]),
  id: z.uuid(),
  moduleId: z.uuid(),
});

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function parseItem(formData: FormData) {
  return itemSchema.safeParse({ kind: field(formData, "kind"), id: field(formData, "id"), moduleId: field(formData, "moduleId") });
}

function refresh(moduleId: string) {
  revalidatePath("/cours");
  revalidatePath(`/cours/${moduleId}`);
  revalidatePath("/tableau-de-bord");
}

export async function renameItemAction(_prev: CoursesFormState, formData: FormData): Promise<CoursesFormState> {
  await requireUserId();
  const item = parseItem(formData);
  if (!item.success) return { error: "unknown" };
  const { kind, id, moduleId } = item.data;
  const supabase = await createUserClient();

  let error: unknown = null;
  if (kind === "module") {
    const parsed = parseModuleName(field(formData, "name"));
    if (!parsed.ok) return { error: parsed.error };
    ({ error } = await supabase.from("modules").update({ name: parsed.name }).eq("id", id));
  } else {
    const parsed = parseChapterTitle(field(formData, "name"));
    if (!parsed.ok) return { error: parsed.error };
    const table = kind === "chapter" ? "chapters" : "documents";
    ({ error } = await supabase.from(table).update({ title: parsed.title }).eq("id", id));
  }
  if (error) return { error: "unknown" };

  refresh(moduleId);
  return { saved: true };
}

/** Supprime l'élément, ses documents et leurs fichiers. Un chapitre part avec ses documents. */
export async function deleteItemAction(_prev: CoursesFormState, formData: FormData): Promise<CoursesFormState> {
  await requireUserId();
  const item = parseItem(formData);
  if (!item.success) return { error: "unknown" };
  const { kind, id, moduleId } = item.data;
  const supabase = await createUserClient();

  const column = kind === "module" ? "module_id" : kind === "chapter" ? "chapter_id" : "id";
  const { data: documents, error: readError } = await supabase.from("documents").select("id, storage_path").eq(column, id);
  if (readError) return { error: "unknown" };

  if (documents.length > 0) {
    const { error } = await supabase.from("documents").delete().in("id", documents.map((d) => d.id));
    if (error) return { error: "unknown" };
    // Les fichiers suivent ; un fichier orphelin reste privé et n'est plus lisible depuis l'application.
    await supabase.storage.from("documents").remove(documents.map((d) => d.storage_path));
  }
  if (kind !== "document") {
    const { error } = await supabase.from(kind === "module" ? "modules" : "chapters").delete().eq("id", id);
    if (error) return { error: "unknown" };
  }

  refresh(moduleId);
  if (kind === "module") redirect("/cours");
  return {};
}
