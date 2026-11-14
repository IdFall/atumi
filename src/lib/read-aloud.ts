/**
 * Lecture audio des documents (PDF, Word) : la voix du navigateur
 * (`speechSynthesis`) lit le texte du document, sans serveur ni modèle.
 * Le texte est découpé en morceaux courts, car certains navigateurs
 * coupent une phrase trop longue au bout de quelques secondes.
 */

/** Longueur maximale d'un morceau lu d'une traite. */
export const READ_CHUNK_MAX = 220;

/** Vitesses proposées à l'élève. */
export const READ_SPEEDS = [0.75, 1, 1.25, 1.5] as const;

/** Espaces ramenés à un seul, mots coupés en fin de ligne (« exem-\nple ») recollés. */
export function normalizeReadText(raw: string): string {
  return raw
    .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

/** Découpe le texte en morceaux d'au plus `max` caractères, en coupant de préférence entre deux phrases. */
export function splitForReading(text: string, max = READ_CHUNK_MAX): string[] {
  const clean = normalizeReadText(text);
  if (!clean) return [];
  const sentences = clean.match(/[^.!?;:…]+[.!?;:…]*\s*/gu) ?? [clean];
  const chunks: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const sentence of sentences) {
    if (sentence.length > max) {
      push();
      // Phrase trop longue : coupée entre deux mots.
      let rest = sentence.trim();
      while (rest.length > max) {
        const cut = rest.lastIndexOf(" ", max);
        const at = cut > max / 2 ? cut : max;
        chunks.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      current = rest ? `${rest} ` : "";
      continue;
    }
    if ((current + sentence).length > max) push();
    current += sentence;
  }
  push();
  return chunks;
}

/** Langue de la voix selon la langue choisie. */
export function voiceLang(locale: "fr" | "en"): string {
  return locale === "en" ? "en-US" : "fr-FR";
}
