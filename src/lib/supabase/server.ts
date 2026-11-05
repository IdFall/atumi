import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Client Supabase agissant au nom de l'utilisateur connecté.
 * Toutes les requêtes passent par les règles RLS : c'est le client par défaut.
 */
export async function createUserClient() {
  const env = publicEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : le proxy se charge du rafraîchissement.
        }
      },
    },
  });
}

/**
 * Client avec la clé secrète : contourne RLS.
 * Réservé aux traitements serveur (workers, écriture des résultats calculés,
 * journal de consommation IA). Ne jamais l'utiliser pour lire des données
 * à la demande d'un utilisateur sans filtrer explicitement sur son identifiant.
 */
export function createServiceClient() {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
