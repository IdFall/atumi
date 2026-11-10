"use server";

import { revalidatePath } from "next/cache";

import { createUserClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";

/**
 * Photo de profil : le navigateur dépose l'image dans le dossier de l'élève
 * (règles du stockage `avatars`), puis le serveur l'enregistre sur le profil
 * et supprime l'ancienne.
 */
export async function setAvatarAction(path: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  if (typeof path !== "string" || !new RegExp(`^${userId}/[A-Za-z0-9_-]{1,64}\\.(jpg|png|webp)$`).test(path)) return { ok: false };
  const supabase = await createUserClient();
  const { data: profile } = await supabase.from("profiles").select("avatar_path").eq("id", userId).single();
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) return { ok: false };
  if (profile?.avatar_path && profile.avatar_path !== path) await supabase.storage.from("avatars").remove([profile.avatar_path]);
  revalidatePath("/tableau-de-bord");
  return { ok: true };
}

export async function removeAvatarAction(): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const supabase = await createUserClient();
  const { data: profile } = await supabase.from("profiles").select("avatar_path").eq("id", userId).single();
  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", userId);
  if (error) return { ok: false };
  if (profile?.avatar_path) await supabase.storage.from("avatars").remove([profile.avatar_path]);
  revalidatePath("/tableau-de-bord");
  return { ok: true };
}
