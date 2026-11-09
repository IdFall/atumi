/**
 * Outils de la recherche dans les cours, sans accès à la base : nettoyage de
 * la requête, motif `ilike` sûr, extrait centré sur le mot trouvé.
 */

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

/** Requête nettoyée (espaces réduits, longueur bornée) ; `null` si trop courte. */
export function cleanQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const q = raw.replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH);
  return q.length >= SEARCH_MIN_LENGTH ? q : null;
}

/** Motif `ilike` « contient », avec %, _ et \ échappés. */
export function containsPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function fold(text: string): string {
  // Sans accents ni majuscules, même longueur que le texte d'origine pour garder les positions.
  return Array.from(text, (c) => c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().charAt(0) || c).join("");
}

export interface ExcerptPart {
  text: string;
  match: boolean;
}

/**
 * Extrait d'environ `size` caractères autour du premier mot de la requête trouvé
 * (sans tenir compte des accents ni des majuscules), découpé pour surligner les mots.
 */
export function excerpt(content: string, q: string, size = 180): ExcerptPart[] {
  const text = content.replace(/\s+/g, " ").trim();
  const folded = fold(text);
  const all = fold(q)
    .split(" ")
    .filter((w) => w.length >= SEARCH_MIN_LENGTH);
  // Les petits mots (« de », « la ») ne sont surlignés que s'ils sont seuls dans la requête.
  const long = all.filter((w) => w.length >= 3);
  const words = long.length ? long : all;
  const isLetter = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
  // Début de mot seulement : « théorème » trouve « théorèmes », pas « dé » dans « idée ».
  const find = (haystack: string, w: string, from = 0): number => {
    for (let i = haystack.indexOf(w, from); i >= 0; i = haystack.indexOf(w, i + 1)) {
      if (!isLetter(haystack[i - 1])) return i;
    }
    return -1;
  };
  const first = Math.min(...words.map((w) => find(folded, w)).filter((i) => i >= 0), Number.POSITIVE_INFINITY);

  const start = Number.isFinite(first) ? Math.max(0, first - Math.floor(size / 3)) : 0;
  const end = Math.min(text.length, start + size);
  const slice = text.slice(start, end);
  const foldedSlice = folded.slice(start, end);

  const marks = new Array<boolean>(slice.length).fill(false);
  for (const w of words) {
    for (let i = find(foldedSlice, w); i >= 0; i = find(foldedSlice, w, i + w.length)) {
      marks.fill(true, i, i + w.length);
    }
  }

  const parts: ExcerptPart[] = [];
  if (start > 0) parts.push({ text: "…", match: false });
  for (let i = 0; i < slice.length; ) {
    let j = i;
    while (j < slice.length && marks[j] === marks[i]) j++;
    parts.push({ text: slice.slice(i, j), match: marks[i] });
    i = j;
  }
  if (end < text.length) parts.push({ text: "…", match: false });
  return parts;
}
