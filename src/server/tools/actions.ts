"use server";

import { getLocale } from "@/i18n/server";
import { requireUserId } from "@/server/auth/session";
import { referenceLookupSchema } from "@/server/validation";

import { lookupDictionary, lookupEncyclopedia, type ReferenceResult } from "./reference";

/** Définition (Wiktionnaire) ou article (Wikipédia) affiché dans la boîte à outils, pour un élève connecté. */
export async function lookupReferenceAction(kind: "dictionary" | "encyclopedia", term: string): Promise<ReferenceResult> {
  await requireUserId();
  const locale = await getLocale();
  // Appel direct possible avec n'importe quelles valeurs : type et longueur revérifiés.
  const parsed = referenceLookupSchema.safeParse({ kind, term: typeof term === "string" ? term.slice(0, 200) : term });
  if (!parsed.success) return { ok: false, error: "notFound" };
  const { term: cleanTerm } = parsed.data;
  return parsed.data.kind === "encyclopedia" ? lookupEncyclopedia(cleanTerm, locale) : lookupDictionary(cleanTerm, locale);
}
