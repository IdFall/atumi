/**
 * Configuration des pays.
 *
 * Ouvrir un pays = ajouter une entrée ici (et ses niveaux d'étude en base),
 * puis passer `isActive` à true. Aucun autre code ne doit dépendre d'un pays précis.
 * La source de vérité des niveaux d'étude est la table `education_levels`.
 */

export type Cycle = "college" | "lycee" | "universite";

export type PaymentMethod = "wave" | "orange_money" | "free_money" | "mtn_momo" | "moov_money" | "card";

export interface CountryConfig {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  currency: string; // ISO 4217
  phonePrefix: string; // indicatif international, ex. +221
  defaultLocale: Locale;
  timezone: string;
  paymentMethods: PaymentMethod[];
  isActive: boolean;
}

export type Locale = "fr";

export const COUNTRIES: readonly CountryConfig[] = [
  {
    code: "SN",
    name: "Sénégal",
    currency: "XOF",
    phonePrefix: "+221",
    defaultLocale: "fr",
    timezone: "Africa/Dakar",
    paymentMethods: ["wave", "orange_money", "free_money"],
    isActive: true,
  },
  {
    code: "CI",
    name: "Côte d'Ivoire",
    currency: "XOF",
    phonePrefix: "+225",
    defaultLocale: "fr",
    timezone: "Africa/Abidjan",
    paymentMethods: ["wave", "orange_money", "mtn_momo", "moov_money"],
    isActive: false,
  },
  {
    code: "ML",
    name: "Mali",
    currency: "XOF",
    phonePrefix: "+223",
    defaultLocale: "fr",
    timezone: "Africa/Bamako",
    paymentMethods: ["orange_money", "moov_money"],
    isActive: false,
  },
  {
    code: "CM",
    name: "Cameroun",
    currency: "XAF",
    phonePrefix: "+237",
    defaultLocale: "fr",
    timezone: "Africa/Douala",
    paymentMethods: ["orange_money", "mtn_momo"],
    isActive: false,
  },
];

export function getCountry(code: string): CountryConfig | undefined {
  return COUNTRIES.find((c) => c.code === code.toUpperCase());
}

export function activeCountries(): CountryConfig[] {
  return COUNTRIES.filter((c) => c.isActive);
}

/**
 * Normalise un numéro au format international E.164.
 * Un numéro local est rattaché à l'indicatif du pays donné.
 * Renvoie null si le numéro n'est pas plausible.
 */
export function toE164(raw: string, countryCode: string): string | null {
  const cleaned = raw.replace(/[\s.\-()]/g, "");
  let candidate: string;
  if (cleaned.startsWith("+")) {
    candidate = cleaned;
  } else if (cleaned.startsWith("00")) {
    candidate = `+${cleaned.slice(2)}`;
  } else {
    const country = getCountry(countryCode);
    if (!country) return null;
    candidate = `${country.phonePrefix}${cleaned.replace(/^0+/, "")}`;
  }
  return /^\+[1-9][0-9]{6,14}$/.test(candidate) ? candidate : null;
}

/** Déduit le pays depuis l'indicatif d'un numéro E.164 (pays actifs ou non). */
export function countryFromPhone(e164: string): CountryConfig | undefined {
  return [...COUNTRIES]
    .sort((a, b) => b.phonePrefix.length - a.phonePrefix.length)
    .find((c) => e164.startsWith(c.phonePrefix));
}

/** Les collégiens et lycéens sont traités comme mineurs : consentement parental requis. */
export function requiresParentalConsent(cycle: Cycle): boolean {
  return cycle === "college" || cycle === "lycee";
}
