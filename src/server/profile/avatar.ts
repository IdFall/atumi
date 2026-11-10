import { createUserClient } from "@/lib/supabase/server";

/** Photo de profil : privée, servie par un lien signé d'une heure ; null sans photo. */
export async function getAvatarUrl(userId: string): Promise<string | null> {
  const supabase = await createUserClient();
  const { data: profile } = await supabase.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
  if (!profile?.avatar_path) return null;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600);
  return data?.signedUrl ?? null;
}
