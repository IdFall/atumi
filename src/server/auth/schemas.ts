import { z } from "zod";

import { countryFromPhone, getCountry, isAdultAge, isCycleOpen, parseAge, toE164, type Cycle } from "@/config/countries";
import { PHONE_SIGN_UP_OPEN } from "@/config/sign-up";
import type { AuthErrorKey } from "@/i18n/messages";

export const CGU_VERSION = "2026-11-13";

export type Identifier = { kind: "email"; email: string } | { kind: "phone"; phone: string };

const EMAIL = z.email();

/**
 * Lit un identifiant saisi librement : une adresse e-mail ou un numéro de téléphone.
 * Un numéro local est rattaché à l'indicatif du pays par défaut.
 */
export function parseIdentifier(raw: string, defaultCountry: string): Identifier | null {
  const value = raw.trim();
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return EMAIL.safeParse(email).success ? { kind: "email", email } : null;
  }
  const phone = toE164(value, defaultCountry);
  return phone ? { kind: "phone", phone } : null;
}

export type FieldErrors<F extends string> = Partial<Record<F, AuthErrorKey>>;

export type ParseResult<T, F extends string> = { ok: true; data: T } | { ok: false; errors: FieldErrors<F> };

type SignUpField = "fullName" | "identifier" | "password" | "passwordConfirm" | "age" | "cycle" | "guardianPhone" | "acceptCgu";

export interface SignUpData {
  /** Prénom et nom, tels que saisis (espaces ramenés à un seul). */
  fullName: string;
  identifier: Identifier;
  password: string;
  cycle: Cycle;
  /** Élève (par défaut) ou enseignant : un enseignant est majeur, sans accord parental. */
  role: "eleve" | "enseignant";
  countryCode: string;
  guardianPhone: string | null;
  /** Âge déclaré à l'inscription. */
  age: number;
  /** Âge déclaré au moins égal à la majorité du pays : pas d'accord parental. */
  isAdult: boolean;
}

export interface SignUpInput {
  fullName?: unknown;
  identifier?: unknown;
  password?: unknown;
  passwordConfirm?: unknown;
  cycle?: unknown;
  role?: unknown;
  guardianPhone?: unknown;
  age?: unknown;
  acceptCgu?: unknown;
}

/**
 * Prénom et nom : lettres (accents compris), majuscules ou minuscules, espaces,
 * trait d'union et apostrophe ; au moins deux lettres, 60 caractères au plus.
 */
const FULL_NAME = /^\p{L}[\p{L}\p{M} '’-]{0,58}[\p{L}\p{M}]$/u;

/** Ramène les espaces à un seul et retire ceux du début et de la fin. */
export function normalizeFullName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Prénom affiché aux autres (défi public) : le premier mot du nom. */
export function firstNameOf(fullName: string): string {
  return normalizeFullName(fullName).split(" ")[0] ?? "";
}

/**
 * Identifiant technique dérivé du nom (« Idrissa Fall » → « idrissa.fall ») :
 * sans accents, en minuscules, 3 à 32 caractères (format exigé par la base).
 * Le serveur ajoute des chiffres s'il est déjà pris.
 */
export function usernameBase(fullName: string): string {
  const slug = fullName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24)
    .replace(/\.+$/, "");
  if (slug.length >= 3) return slug;
  return slug ? `eleve.${slug}` : "eleve";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseSignUp(
  input: SignUpInput,
  defaultCountry: string,
  { phoneSignUpOpen = PHONE_SIGN_UP_OPEN }: { phoneSignUpOpen?: boolean } = {},
): ParseResult<SignUpData, SignUpField> {
  const errors: FieldErrors<SignUpField> = {};

  const fullName = normalizeFullName(typeof input.fullName === "string" ? input.fullName : "");
  if (!fullName) errors.fullName = "fullNameRequired";
  else if (!FULL_NAME.test(fullName) || !fullName.includes(" ")) errors.fullName = "fullNameInvalid";

  const parsedIdentifier = parseIdentifier(text(input.identifier), defaultCountry);
  if (!parsedIdentifier) errors.identifier = "emailInvalid";
  // Inscription par téléphone en pause : un numéro est refusé avec un message clair.
  const phonePaused = parsedIdentifier?.kind === "phone" && !phoneSignUpOpen;
  if (phonePaused) errors.identifier = "phoneSignUpPaused";
  const identifier = phonePaused ? null : parsedIdentifier;

  // Le pays vient de l'indicatif quand on s'inscrit par téléphone.
  let countryCode = defaultCountry;
  if (identifier?.kind === "phone") {
    const country = countryFromPhone(identifier.phone);
    if (!country?.isActive) errors.identifier = "countryNotOpen";
    else countryCode = country.code;
  }

  const password = typeof input.password === "string" ? input.password : "";
  if (password.length < 8 || password.length > 72) errors.password = "passwordLength";
  else if (input.passwordConfirm !== password) errors.passwordConfirm = "passwordMismatch";

  const role = text(input.role) === "enseignant" ? "enseignant" : "eleve";

  // Seuls les cycles ouverts dans le pays sont acceptés : V1, lycée et université
  // pour un élève ; du primaire à l'université pour un enseignant.
  const rawCycle = text(input.cycle);
  const cycleOk = isCycleOpen(countryCode, rawCycle, role);
  if (!cycleOk) errors.cycle = rawCycle ? "cycleNotOpen" : "cycleRequired";
  const cycle = rawCycle as Cycle;

  // Âge déclaré : majeur, ou élève mineur selon la règle du pays (avis au
  // parent, ou inscription fermée). Un enseignant doit être majeur.
  const ageText = text(input.age);
  const age = parseAge(ageText);
  if (age === null) errors.age = ageText ? "ageInvalid" : "ageRequired";
  const country = getCountry(countryCode);
  const isAdult = age !== null && country !== undefined && isAdultAge(country, age);
  let guardianPhone: string | null = null;
  if (age !== null && country && !isAdult) {
    if (role === "enseignant") errors.age = "teacherMinor";
    else if (country.minorSignUp === "closed") errors.age = "minorClosed";
    else {
      guardianPhone = toE164(text(input.guardianPhone), countryCode);
      if (!guardianPhone) errors.guardianPhone = "guardianPhoneRequired";
      else if (identifier?.kind === "phone" && identifier.phone === guardianPhone) {
        errors.guardianPhone = "guardianPhoneSameAsUser";
      }
    }
  }

  if (input.acceptCgu !== "on" && input.acceptCgu !== true) errors.acceptCgu = "cguRequired";

  if (Object.keys(errors).length > 0 || !identifier || !country || age === null) {
    return { ok: false, errors };
  }
  return { ok: true, data: { fullName, identifier, password, cycle, role, countryCode, guardianPhone, age, isAdult } };
}

type SignInField = "identifier" | "password";

export function parseSignIn(
  input: { identifier?: unknown; password?: unknown },
  defaultCountry: string,
): ParseResult<{ identifier: Identifier; password: string }, SignInField> {
  const identifier = parseIdentifier(text(input.identifier), defaultCountry);
  const password = typeof input.password === "string" ? input.password : "";
  const errors: FieldErrors<SignInField> = {};
  if (!identifier) errors.identifier = "identifierInvalid";
  if (!password) errors.password = "passwordRequired";
  if (!identifier || !password) return { ok: false, errors };
  return { ok: true, data: { identifier, password } };
}
