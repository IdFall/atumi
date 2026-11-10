import { serverEnv } from "@/lib/env";
import { createUserClient } from "@/lib/supabase/server";

export interface CallSettings {
  /** Service de voix configuré (clé Gemini présente). */
  available: boolean;
  /** Forfait ou essai en cours. */
  hasAccess: boolean;
  /** Secondes d'appel restantes sur la période ; null = sans limite. */
  secondsLeft: number | null;
}

/** Ce que l'interface doit savoir pour proposer (ou non) un appel avec le professeur. */
export async function getCallSettings(): Promise<CallSettings> {
  const available = Boolean(serverEnv().GEMINI_API_KEY);
  const supabase = await createUserClient();
  const { data } = await supabase.rpc("call_quota");
  const row = (data as { seconds_remaining: number | null }[] | null)?.[0];
  return { available, hasAccess: Boolean(row), secondsLeft: row ? row.seconds_remaining : 0 };
}
