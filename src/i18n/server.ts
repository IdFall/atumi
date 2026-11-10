import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { LOCALES, type Locale } from "@/config/countries";
import { detectLocale } from "@/lib/locale-detect";

import { getMessages, type Messages } from "./messages";

/** Cookie qui garde la langue de l'interface choisie (FR / EN). */
export const LOCALE_COOKIE = "atumi_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Langue de l'interface pour la requête en cours : le choix de l'élève
 * (cookie), sinon celle de son pays (en-tête de géolocalisation de Vercel),
 * sinon celle de son navigateur, sinon le français.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(value)) return value;
  const h = await headers();
  return detectLocale({ country: h.get("x-vercel-ip-country"), acceptLanguage: h.get("accept-language") });
});

/** Textes de l'interface dans la langue de la requête. */
export async function getT(): Promise<Messages> {
  return getMessages(await getLocale());
}
