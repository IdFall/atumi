"use server";

import { getLocale } from "@/i18n/server";
import { requireUserId } from "@/server/auth/session";

import { lookupDictionary, lookupEncyclopedia, type ReferenceResult } from "./reference";

/** Définition (Wiktionnaire) ou article (Wikipédia) affiché dans la boîte à outils, pour un élève connecté. */
export async function lookupReferenceAction(kind: "dictionary" | "encyclopedia", term: string): Promise<ReferenceResult> {
  await requireUserId();
  const locale = await getLocale();
  if (typeof term !== "string") return { ok: false, error: "notFound" };
  return kind === "encyclopedia" ? lookupEncyclopedia(term, locale) : lookupDictionary(term, locale);
}
