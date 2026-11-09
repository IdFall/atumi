import { z } from "zod";

import { countryFromPhone, getCountry, isCycleOpen, requiresParentalConsent, toE164, type Cycle } from "@/config/countries";
import type { AuthErrorKey } from "@/i18n/messages";

export const CGU_VERSION = "2026-11";

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

type SignUpField = "username" | "identifier" | "password" | "cycle" | "guardianPhone" | "acceptCgu";

export interface SignUpData {
  username: string;
  identifier: Identifier;
  password: string;
  cycle: Cycle;
  countryCode: string;
  guardianPhone: string | null;
  /** Lycéen qui déclare avoir 18 ans ou plus : pas d'accord parental. */
  isAdult: boolean;
}

export interface SignUpInput {
  username?: unknown;
  identifier?: unknown;
  password?: unknown;
  cycle?: unknown;
  guardianPhone?: unknown;
  isAdult?: unknown;
  acceptCgu?: unknown;
}

const USERNAME = /^[a-z0-9_.]{3,32}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseSignUp(input: SignUpInput, defaultCountry: string): ParseResult<SignUpData, SignUpField> {
  const errors: FieldErrors<SignUpField> = {};

  const username = text(input.username).toLowerCase();
  if (!USERNAME.test(username)) errors.username = "usernameInvalid";

  const identifier = parseIdentifier(text(input.identifier), defaultCountry);
  if (!identifier) errors.identifier = "identifierInvalid";

  // Le pays vient de l'indicatif quand on s'inscrit par téléphone.
  let countryCode = defaultCountry;
  if (identifier?.kind === "phone") {
    const country = countryFromPhone(identifier.phone);
    if (!country?.isActive) errors.identifier = "countryNotOpen";
    else countryCode = country.code;
  }

  const password = typeof input.password === "string" ? input.password : "";
  if (password.length < 8 || password.length > 72) errors.password = "passwordLength";

  // Seuls les cycles ouverts dans le pays sont acceptés (V1 : lycée et université).
  const rawCycle = text(input.cycle);
  const cycleOk = isCycleOpen(countryCode, rawCycle);
  if (!cycleOk) errors.cycle = rawCycle ? "cycleNotOpen" : "cycleRequired";
  const cycle = rawCycle as Cycle;

  // Lycéen majeur (case « 18 ans ou plus ») : pas de numéro de parent.
  const needsConsent = cycleOk && requiresParentalConsent(cycle);
  const isAdult = needsConsent && (input.isAdult === "on" || input.isAdult === true);
  let guardianPhone: string | null = null;
  if (needsConsent && !isAdult) {
    guardianPhone = toE164(text(input.guardianPhone), countryCode);
    if (!guardianPhone) errors.guardianPhone = "guardianPhoneRequired";
    else if (identifier?.kind === "phone" && identifier.phone === guardianPhone) {
      errors.guardianPhone = "guardianPhoneSameAsUser";
    }
  }

  if (input.acceptCgu !== "on" && input.acceptCgu !== true) errors.acceptCgu = "cguRequired";

  if (Object.keys(errors).length > 0 || !identifier || !getCountry(countryCode)) {
    return { ok: false, errors };
  }
  return { ok: true, data: { username, identifier, password, cycle, countryCode, guardianPhone, isAdult } };
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
