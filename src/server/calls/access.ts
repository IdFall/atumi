import { serverEnv } from "@/lib/env";
import { createUserClient } from "@/lib/supabase/server";

/** Forfait interne de l'équipe (comptes testeurs). */
const TESTER_PLAN = "sn-testeur";

/**
 * Appels ouverts à tous les abonnés : clé Gemini posée ET `ATUMI_VOICE_OPEN=true`.
 * Tant que la clé est en formule gratuite (Google se sert des conversations),
 * l'interrupteur reste fermé : seuls les comptes de l'équipe peuvent appeler.
 */
export function voiceOpenToAll(): boolean {
  const env = serverEnv();
  return Boolean(env.GEMINI_API_KEY) && env.ATUMI_VOICE_OPEN === "true";
}

/** Vrai si l'utilisateur connecté peut lancer un appel avec le Prof NEO. */
export async function voiceAllowedForMe(): Promise<boolean> {
  if (!serverEnv().GEMINI_API_KEY) return false;
  if (voiceOpenToAll()) return true;
  // Interrupteur fermé : administrateurs et comptes testeurs seulement.
  const supabase = await createUserClient();
  const [{ data: isAdmin }, { data: access }] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.rpc("my_access").maybeSingle<{ plan_code: string | null }>(),
  ]);
  return isAdmin === true || access?.plan_code === TESTER_PLAN;
}
