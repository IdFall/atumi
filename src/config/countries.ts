/**
 * Configuration des pays.
 *
 * Ouvrir un pays = ajouter une entrée ici (et ses niveaux d'étude en base),
 * puis passer `isActive` à true. Aucun autre code ne doit dépendre d'un pays précis.
 * La source de vérité des niveaux d'étude est la table `education_levels`.
 */

export type Cycle = "college" | "lycee" | "universite";

/** Tous les cycles connus, dans l'ordre d'affichage. */
export const ALL_CYCLES: readonly Cycle[] = ["college", "lycee", "universite"];

export type PaymentMethod = "wave" | "orange_money" | "free_money" | "mtn_momo" | "moov_money" | "card";

export interface CountryConfig {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  currency: string; // ISO 4217
  phonePrefix: string; // indicatif international, ex. +221
  defaultLocale: Locale;
  timezone: string;
  paymentMethods: PaymentMethod[];
  /** Cycles ouverts à l'inscription. V1 : lycée et université (le collège viendra plus tard). */
  openCycles: readonly Cycle[];
  /** Langues proposées pour le professeur IA, la première étant celle par défaut. */
  tutorLanguages: readonly TutorLanguage[];
  isActive: boolean;
}

const V1_CYCLES: readonly Cycle[] = ["lycee", "universite"];

/** Langues de l'interface (dictionnaires de src/i18n). */
export type Locale = "fr" | "en";
export const LOCALES: readonly Locale[] = ["fr", "en"];

/** Langues dans lesquelles le professeur IA peut répondre. Le wolof est en bêta. */
export type TutorLanguage = "fr" | "en" | "wo";
export const TUTOR_LANGUAGES: readonly TutorLanguage[] = ["fr", "en", "wo"];

export const COUNTRIES: readonly CountryConfig[] = [
  {
    code: "SN",
    name: "Sénégal",
    currency: "XOF",
    phonePrefix: "+221",
    defaultLocale: "fr",
    timezone: "Africa/Dakar",
    paymentMethods: ["wave", "orange_money", "free_money"],
    openCycles: V1_CYCLES,
    tutorLanguages: ["fr", "en", "wo"],
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
    openCycles: V1_CYCLES,
    tutorLanguages: ["fr", "en"],
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
    openCycles: V1_CYCLES,
    tutorLanguages: ["fr", "en"],
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
    openCycles: V1_CYCLES,
    tutorLanguages: ["fr", "en"],
    isActive: false,
  },
];

export function getCountry(code: string): CountryConfig | undefined {
  return COUNTRIES.find((c) => c.code === code.toUpperCase());
}

export function activeCountries(): CountryConfig[] {
  return COUNTRIES.filter((c) => c.isActive);
}

/** Pays proposé par défaut (avant que l'indicatif du téléphone ne le précise). */
export function defaultCountry(): CountryConfig {
  const country = activeCountries()[0];
  if (!country) throw new Error("Aucun pays actif dans la configuration.");
  return country;
}

/** Vrai si la langue est proposée pour le professeur IA dans ce pays. */
export function isTutorLanguageOffered(countryCode: string, language: string): language is TutorLanguage {
  return getCountry(countryCode)?.tutorLanguages.includes(language as TutorLanguage) ?? false;
}

/** Vrai si le cycle est ouvert à l'inscription dans ce pays. */
export function isCycleOpen(countryCode: string, cycle: string): cycle is Cycle {
  return getCountry(countryCode)?.openCycles.includes(cycle as Cycle) ?? false;
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

/** Collégiens et lycéens, souvent mineurs : accord parental requis. */
export function requiresParentalConsent(cycle: Cycle): boolean {
  return cycle === "college" || cycle === "lycee";
}
