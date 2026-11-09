import type { Locale } from "@/config/countries";

/**
 * Dictionnaire et encyclopédie de la boîte à outils, affichés dans ATUMI :
 * définitions du Wiktionnaire et résumé de l'article Wikipédia, dans la langue
 * de l'interface. Sans IA ni forfait. Le texte reçu est une donnée : il est
 * réduit à du texte brut (aucun HTML) et seules les images de Wikimedia sont gardées.
 */

export interface DictionaryEntry {
  partOfSpeech: string;
  definitions: string[];
}

export type ReferenceResult =
  | { ok: true; kind: "dictionary"; word: string; entries: DictionaryEntry[]; url: string }
  | { ok: true; kind: "encyclopedia"; title: string; extract: string; image: string | null; url: string }
  | { ok: false; error: "notFound" | "unavailable" };

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

const USER_AGENT = "ATUMI/1.0 (https://atumi.vercel.app)";
const MAX_DEFINITIONS = 8;

async function getJson(fetcher: Fetcher, url: string): Promise<unknown | null> {
  const res = await fetcher(url, {
    headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function cleanTerm(term: string): string {
  return term.replace(/\s+/g, " ").trim().slice(0, 100);
}

/** Texte brut à partir d'un fragment HTML (définitions du Wiktionnaire anglais). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const FR_PARTS: Record<string, string> = {
  nom: "Nom commun",
  "nom propre": "Nom propre",
  verbe: "Verbe",
  adjectif: "Adjectif",
  adverbe: "Adverbe",
  pronom: "Pronom",
  préposition: "Préposition",
  conjonction: "Conjonction",
  interjection: "Interjection",
  locution: "Locution",
  "locution nominale": "Locution nominale",
  "locution verbale": "Locution verbale",
  symbole: "Symbole",
  sigle: "Sigle",
  abréviation: "Abréviation",
};

/** Modèles du Wiktionnaire réduits à leur texte utile : domaine entre parenthèses, lien = mot, le reste retiré. */
function cleanTemplates(text: string): string {
  let previous = "";
  let out = text;
  // Les modèles peuvent s'imbriquer : on traite d'abord les plus intérieurs.
  while (out !== previous) {
    previous = out;
    out = out.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => {
      const parts = inner.split("|").map((p) => p.trim());
      const name = parts[0].toLowerCase();
      if (name === "lien" || name === "l" || name === "w" || name === "lien web") return parts[1] ?? "";
      if (name === "term" || name === "terme") return parts[1] ? `(${parts[1]})` : "";
      if (name === "e" || name === "exp") return parts[1] ?? "";
      // {{mathématiques|fr}} → (Mathématiques)
      if (parts.length <= 2 && (parts[1] === undefined || parts[1] === "fr") && /^[\p{L} -]+$/u.test(parts[0]) && parts[0].length > 2) {
        return `(${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)})`;
      }
      return "";
    });
  }
  return out;
}

export function wikitextToText(text: string): string {
  return cleanTemplates(
    text
      .replace(/<ref[^>]*\/>/gi, "")
      .replace(/<ref[\s\S]*?<\/ref>/gi, "")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Définitions françaises d'une page du Wiktionnaire (wikitexte). */
export function parseFrenchWiktionary(wikitext: string): DictionaryEntry[] {
  const start = wikitext.search(/==\s*\{\{langue\|fr\}\}\s*==/);
  if (start < 0) return [];
  const rest = wikitext.slice(start + 1);
  const end = rest.search(/\n==\s*\{\{langue\|(?!fr\})/);
  const section = end < 0 ? rest : rest.slice(0, end);

  const entries: DictionaryEntry[] = [];
  let current: DictionaryEntry | null = null;
  let count = 0;
  for (const line of section.split("\n")) {
    const heading = /^===\s*\{\{S\|([^|}]+)(?:\|[^}]*)?\}\}\s*===\s*$/.exec(line.trim());
    if (heading) {
      const key = heading[1].trim().toLowerCase();
      const label = FR_PARTS[key];
      current = label ? { partOfSpeech: label, definitions: [] } : null;
      if (current) entries.push(current);
      continue;
    }
    if (!current || count >= MAX_DEFINITIONS) continue;
    const def = /^#(?![*:#])\s*(.+)$/.exec(line.trim());
    if (def) {
      const text = wikitextToText(def[1]);
      if (text.length > 1) {
        current.definitions.push(text);
        count++;
      }
    }
  }
  return entries.filter((e) => e.definitions.length > 0);
}

/** Définitions anglaises (API REST du Wiktionnaire anglais, section « en »). */
export function parseEnglishDefinitions(data: unknown): DictionaryEntry[] {
  const list = (data as { en?: { partOfSpeech?: string; definitions?: { definition?: string }[] }[] } | null)?.en ?? [];
  const entries: DictionaryEntry[] = [];
  let count = 0;
  for (const item of list) {
    const definitions: string[] = [];
    for (const d of item.definitions ?? []) {
      if (count >= MAX_DEFINITIONS) break;
      const text = htmlToText(d.definition ?? "");
      if (text) {
        definitions.push(text);
        count++;
      }
    }
    if (definitions.length) entries.push({ partOfSpeech: item.partOfSpeech ?? "", definitions });
  }
  return entries;
}

export async function lookupDictionary(rawTerm: string, locale: Locale, fetcher: Fetcher = fetch): Promise<ReferenceResult> {
  const term = cleanTerm(rawTerm);
  if (!term) return { ok: false, error: "notFound" };
  try {
    if (locale === "en") {
      const candidates = [...new Set([term, term.toLowerCase()])];
      for (const word of candidates) {
        const data = await getJson(fetcher, `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
        const entries = parseEnglishDefinitions(data);
        if (entries.length) return { ok: true, kind: "dictionary", word, entries, url: `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}` };
      }
      return { ok: false, error: "notFound" };
    }
    const candidates = [...new Set([term, term.toLowerCase()])];
    for (const word of candidates) {
      const params = new URLSearchParams({ action: "parse", page: word, prop: "wikitext", format: "json", formatversion: "2", redirects: "1" });
      const data = (await getJson(fetcher, `https://fr.wiktionary.org/w/api.php?${params}`)) as { parse?: { title?: string; wikitext?: string } } | null;
      const entries = parseFrenchWiktionary(data?.parse?.wikitext ?? "");
      if (entries.length) {
        const title = data?.parse?.title ?? word;
        return { ok: true, kind: "dictionary", word: title, entries, url: `https://fr.wiktionary.org/wiki/${encodeURIComponent(title)}` };
      }
    }
    return { ok: false, error: "notFound" };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export async function lookupEncyclopedia(rawTerm: string, locale: Locale, fetcher: Fetcher = fetch): Promise<ReferenceResult> {
  const term = cleanTerm(rawTerm);
  if (!term) return { ok: false, error: "notFound" };
  const host = `https://${locale === "en" ? "en" : "fr"}.wikipedia.org`;
  try {
    const params = new URLSearchParams({ action: "query", list: "search", srsearch: term, srlimit: "1", format: "json", formatversion: "2" });
    const search = (await getJson(fetcher, `${host}/w/api.php?${params}`)) as { query?: { search?: { title?: string }[] } } | null;
    const title = search?.query?.search?.[0]?.title;
    if (!title) return { ok: false, error: "notFound" };
    const summary = (await getJson(fetcher, `${host}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`)) as {
      title?: string;
      extract?: string;
      type?: string;
      thumbnail?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    } | null;
    const extract = summary?.extract?.trim();
    if (!summary || !extract) return { ok: false, error: "notFound" };
    const image = summary.thumbnail?.source ?? null;
    const page = summary.content_urls?.desktop?.page ?? "";
    return {
      ok: true,
      kind: "encyclopedia",
      title: summary.title ?? title,
      extract: extract.slice(0, 2000),
      image: image && /^https:\/\/upload\.wikimedia\.org\/[^\s"'<>]+$/.test(image) ? image : null,
      url: /^https:\/\/(fr|en)\.wikipedia\.org\/wiki\/[^\s"'<>]+$/.test(page) ? page : `${host}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
