/**
 * Configuration des pays.
 *
 * Ouvrir un pays = ajouter une entrée ici (et ses niveaux d'étude en base),
 * puis passer `isActive` à true. Aucun autre code ne doit dépendre d'un pays précis.
 * La source de vérité des niveaux d'étude est la table `education_levels`.
 */

export type Cycle = "primaire" | "college" | "lycee" | "ecole_superieure" | "universite";

/** Tous les cycles connus, dans l'ordre d'affichage. */
export const ALL_CYCLES: readonly Cycle[] = ["primaire", "college", "lycee", "ecole_superieure", "universite"];

/** Rôle choisi à l'inscription (`profiles.role`). */
export type Role = "eleve" | "enseignant";

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
  /** Niveaux qu'un enseignant peut choisir (niveau où il enseigne). */
  teacherCycles: readonly Cycle[];
  /** Langues proposées pour le professeur IA, la première étant celle par défaut. */
  tutorLanguages: readonly TutorLanguage[];
  /** Âge de la majorité, comparé à l'âge déclaré à l'inscription. */
  adultAge: number;
  /**
   * Élève mineur à l'inscription : `parental_notice` = inscription avec le numéro
   * d'un parent, prévenu par WhatsApp et qui peut refuser ; `closed` = pas
   * d'inscription, un parent majeur ouvre le compte.
   */
  minorSignUp: MinorSignUp;
  isActive: boolean;
}

export type MinorSignUp = "parental_notice" | "closed";

const V1_CYCLES: readonly Cycle[] = ["lycee", "universite"];
/** Enseignants : tous les niveaux, du primaire à l'université (Idrissa, 2026-11-12). */
const TEACHER_CYCLES: readonly Cycle[] = ALL_CYCLES;

/** Langues de l'interface (dictionnaires de src/i18n). */
export type Locale = "fr" | "en";
export const LOCALES: readonly Locale[] = ["fr", "en"];

/** Langues dans lesquelles le professeur IA peut répondre. Le wolof (bêta) est prêt dans les consignes mais en attente : proposé dans aucun pays pour l'instant. */
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
    teacherCycles: TEACHER_CYCLES,
    // Wolof en attente (décision du 2026-11-09) : remettre "wo" ici pour le rouvrir.
    tutorLanguages: ["fr", "en"],
    adultAge: 18,
    minorSignUp: "parental_notice",
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
    teacherCycles: TEACHER_CYCLES,
    tutorLanguages: ["fr", "en"],
    adultAge: 18,
    minorSignUp: "parental_notice",
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
    teacherCycles: TEACHER_CYCLES,
    tutorLanguages: ["fr", "en"],
    adultAge: 18,
    minorSignUp: "parental_notice",
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
    teacherCycles: TEACHER_CYCLES,
    tutorLanguages: ["fr", "en"],
    adultAge: 18,
    minorSignUp: "parental_notice",
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

/**
 * Langue d'interface par défaut des pays où ATUMI n'est pas (encore) configuré,
 * pour un visiteur qui n'a pas choisi : anglais dans les pays anglophones.
 * Les pays de COUNTRIES utilisent leur `defaultLocale`.
 */
const OTHER_COUNTRY_LOCALES: Readonly<Record<string, Locale>> = {
  GM: "en", GH: "en", NG: "en", LR: "en", SL: "en", KE: "en", UG: "en", TZ: "en", RW: "en",
  ZA: "en", ZM: "en", ZW: "en", BW: "en", MW: "en", NA: "en", ET: "en", SS: "en",
  GB: "en", IE: "en", US: "en", AU: "en", NZ: "en", IN: "en",
  FR: "fr", BE: "fr", CH: "fr", LU: "fr", MC: "fr", BJ: "fr", BF: "fr", NE: "fr", TG: "fr", GN: "fr",
  GA: "fr", CG: "fr", CD: "fr", TD: "fr", CF: "fr", DJ: "fr", MG: "fr", MR: "fr", MA: "fr", DZ: "fr",
  TN: "fr", HT: "fr", KM: "fr", BI: "fr",
};

/** Langue d'interface par défaut d'un pays ; null si le pays est inconnu. */
export function localeForCountry(code: string | null | undefined): Locale | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  return getCountry(upper)?.defaultLocale ?? OTHER_COUNTRY_LOCALES[upper] ?? null;
}

/** Vrai si la langue est proposée pour le professeur IA dans ce pays. */
export function isTutorLanguageOffered(countryCode: string, language: string): language is TutorLanguage {
  return getCountry(countryCode)?.tutorLanguages.includes(language as TutorLanguage) ?? false;
}

/** Niveaux proposés à l'inscription dans ce pays, selon le rôle choisi. */
export function cyclesFor(countryCode: string, role: Role = "eleve"): readonly Cycle[] {
  const country = getCountry(countryCode);
  if (!country) return [];
  return role === "enseignant" ? country.teacherCycles : country.openCycles;
}

/** Vrai si le cycle est ouvert à l'inscription dans ce pays, pour ce rôle. */
export function isCycleOpen(countryCode: string, cycle: string, role: Role = "eleve"): cycle is Cycle {
  return cyclesFor(countryCode, role).includes(cycle as Cycle);
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

/** Âge déclaré à l'inscription : nombre entier plausible, sinon null. */
export const MIN_SIGN_UP_AGE = 5;
export const MAX_SIGN_UP_AGE = 120;
export function parseAge(value: unknown): number | null {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^[0-9]{1,3}$/.test(raw)) return null;
  const age = Number(raw);
  return age >= MIN_SIGN_UP_AGE && age <= MAX_SIGN_UP_AGE ? age : null;
}

export function isAdultAge(country: CountryConfig, age: number): boolean {
  return age >= country.adultAge;
}
