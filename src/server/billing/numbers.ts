import "server-only";

import type { PaymentMethod } from "@/config/countries";
import { parsePaymentNumbers } from "@/lib/payment-numbers";

/** Numéros affichés à l'élève, dans l'ordre des moyens de paiement du pays. */
export function paymentNumbers(countryCode: string, methods: readonly PaymentMethod[]): { method: PaymentMethod; number: string }[] {
  const byMethod = parsePaymentNumbers(process.env.ATUMI_PAYMENT_NUMBERS)[countryCode] ?? {};
  return methods.flatMap((method) => (byMethod[method] ? [{ method, number: byMethod[method] }] : []));
}
