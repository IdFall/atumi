import "server-only";

import { randomInt } from "node:crypto";

import { createServiceClient } from "@/lib/supabase/server";

/**
 * Premier identifiant technique libre : la base, puis la base suivie de 4 chiffres
 * tirés au hasard (deux personnes peuvent porter le même nom).
 * Hors du fichier des actions : ce n'est pas une action appelable par le navigateur.
 */
export async function freeUsername(base: string): Promise<string | null> {
  const service = createServiceClient();
  const candidates = [base, ...Array.from({ length: 5 }, () => `${base}${randomInt(1000, 10000)}`)];
  for (const candidate of candidates) {
    const { count, error } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("username", candidate);
    if (error) return null;
    if (!count) return candidate;
  }
  return null;
}
