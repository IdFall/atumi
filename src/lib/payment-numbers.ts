import { z } from "zod";

/**
 * Numéros de l'équipe pour recevoir les paiements mobile money, par pays et par
 * moyen : variable de déploiement ATUMI_PAYMENT_NUMBERS, modifiable sans code.
 *   {"SN": {"wave": "+221 77 000 00 00", "orange_money": "+221 78 000 00 00"}}
 */
const schema = z.record(z.string().regex(/^[A-Z]{2}$/), z.record(z.string(), z.string().trim().min(1).max(40)));

export function parsePaymentNumbers(raw: string | undefined): z.infer<typeof schema> {
  if (!raw) return {};
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}
