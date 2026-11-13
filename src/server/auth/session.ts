import "server-only";

import { redirect } from "next/navigation";

import type { Cycle } from "@/config/countries";
import { createUserClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  username: string;
  /** Prénom et nom saisis à l'inscription (vide pour les comptes plus anciens). */
  fullName: string | null;
  cycle: Cycle;
  countryCode: string;
  /** Élève ou enseignant (choisi à l'inscription). */
  role: "eleve" | "enseignant";
}

/**
 * Couche d'accès : seul endroit où l'on lit la session.
 * Redirige vers la connexion si l'utilisateur n'est pas authentifié.
 * À appeler dans un composant placé derrière un <Suspense>.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name, cycle, country_code, role")
    .eq("id", userId)
    .single();
  if (!profile) redirect("/connexion");

  return {
    id: userId,
    username: profile.username,
    fullName: profile.full_name ?? null,
    cycle: profile.cycle as Cycle,
    countryCode: profile.country_code,
    role: profile.role === "enseignant" ? "enseignant" : "eleve",
  };
}

/**
 * Identifiant de l'utilisateur connecté, pour les Server Actions : chacune
 * vérifie elle-même la session (une action est appelable directement).
 */
export async function requireUserId(): Promise<string> {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/connexion");
  return userId;
}
