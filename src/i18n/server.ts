import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { LOCALES, type Locale } from "@/config/countries";

import { getMessages, type Messages } from "./messages";

/** Cookie qui garde la langue de l'interface choisie (FR / EN). */
export const LOCALE_COOKIE = "atumi_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Langue de l'interface pour la requête en cours (français par défaut). */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "fr";
});

/** Textes de l'interface dans la langue de la requête. */
export async function getT(): Promise<Messages> {
  return getMessages(await getLocale());
}
