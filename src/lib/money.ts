/**
 * Montants : la base garde des unités mineures (ISO 4217). Le franc CFA n'a pas
 * de décimales, mais rien ici ne dépend d'une devise précise.
 */

function fractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function minorToMajor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** fractionDigits(currency);
}

/** Montant saisi (« 3000 », « 3 000 », « 12,50 ») vers les unités mineures ; null si invalide. */
export function majorToMinor(input: string, currency: string): number | null {
  const normalized = input.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 10 ** fractionDigits(currency));
  return Number.isSafeInteger(value) ? value : null;
}

export function formatMoney(amountMinor: number, currency: string, dateLocale: string): string {
  return new Intl.NumberFormat(dateLocale, { style: "currency", currency }).format(minorToMajor(amountMinor, currency));
}
