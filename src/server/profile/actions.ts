"use server";

import { revalidatePath } from "next/cache";

import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";

/**
 * Photo de profil : le navigateur dépose l'image dans le dossier de l'élève
 * (règles du stockage `avatars`), puis le serveur vérifie qu'elle y est bien,
 * l'enregistre sur le profil et supprime l'ancienne. L'écriture de
 * `avatar_path` passe par la clé serveur : c'est une valeur vérifiée ici,
 * jamais saisie librement (et la base en ligne n'accorde pas ce droit à l'élève).
 */
export async function setAvatarAction(path: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  if (typeof path !== "string" || !new RegExp(`^${userId}/[A-Za-z0-9_-]{1,64}\\.(jpg|png|webp)$`).test(path)) return { ok: false };
  const supabase = await createUserClient();
  // La photo doit exister dans le dossier de l'élève (lecture avec ses droits).
  const [folder, file] = path.split("/");
  const { data: found } = await supabase.storage.from("avatars").list(folder, { search: file, limit: 1 });
  if (!found?.some((o) => o.name === file)) return { ok: false };
  const { data: profile } = await supabase.from("profiles").select("avatar_path").eq("id", userId).single();
  const { error } = await createServiceClient().from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) return { ok: false };
  if (profile?.avatar_path && profile.avatar_path !== path) await supabase.storage.from("avatars").remove([profile.avatar_path]);
  revalidatePath("/tableau-de-bord");
  return { ok: true };
}

export async function removeAvatarAction(): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const supabase = await createUserClient();
  const { data: profile } = await supabase.from("profiles").select("avatar_path").eq("id", userId).single();
  const { error } = await createServiceClient().from("profiles").update({ avatar_path: null }).eq("id", userId);
  if (error) return { ok: false };
  if (profile?.avatar_path) await supabase.storage.from("avatars").remove([profile.avatar_path]);
  revalidatePath("/tableau-de-bord");
  return { ok: true };
}
