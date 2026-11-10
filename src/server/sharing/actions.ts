"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";

export type CreateShareResult = { id: string } | { error: "quota" | "unknown" };

/**
 * Garde le texte complet d'un long partage (réponse du Prof, recherche ou
 * synthèse de l'élève connecté) pour la page publique « Lire la suite ».
 * La base limite à 30 partages par 24 h.
 */
export async function createSharedTextAction(title: string, markdown: string): Promise<CreateShareResult> {
  const userId = await requireUserId();
  const cleanTitle = title.trim().slice(0, 200);
  const content = markdown.trim();
  if (!cleanTitle || !content || content.length > 60_000) return { error: "unknown" };
  const { data, error } = await createServiceClient()
    .from("shared_texts")
    .insert({ user_id: userId, title: cleanTitle, content_md: content })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message.includes("ATUMI_QUOTA_PARTAGE_ATTEINT") ? "quota" : "unknown" };
  return { id: data.id as string };
}
