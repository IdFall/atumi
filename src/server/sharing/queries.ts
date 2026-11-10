import "server-only";

import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/server";

export interface SharedText {
  title: string;
  contentMd: string;
}

/**
 * Lecture publique d'un texte partagé (sans compte) : clé secrète, filtrée sur
 * l'identifiant aléatoire et la date d'expiration. Aucun nom d'élève ne sort.
 */
export async function getSharedText(shareId: string): Promise<SharedText | null> {
  if (!z.uuid().safeParse(shareId).success) return null;
  const { data } = await createServiceClient()
    .from("shared_texts")
    .select("title, content_md")
    .eq("id", shareId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data ? { title: data.title, contentMd: data.content_md } : null;
}
