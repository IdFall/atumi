/**
 * Découpage du texte d'un document en passages indexables.
 * Un passage reste dans sa page pour que le professeur puisse citer « p. N ».
 */

export interface PageText {
  /** Numéro de page à partir de 1, ou null quand le format n'a pas de pages (Word). */
  page: number | null;
  text: string;
}

export interface Chunk {
  page: number | null;
  content: string;
}

/** Taille visée d'un passage, en caractères (environ 300 à 400 mots). */
export const CHUNK_TARGET = 1500;
/** En dessous, un passage est rattaché au précédent de la même page. */
const CHUNK_MIN = 200;

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Coupe un paragraphe trop long sur les fins de phrase, sinon sur les espaces. */
function splitLong(paragraph: string, max: number): string[] {
  if (paragraph.length <= max) return [paragraph];
  const parts: string[] = [];
  let rest = paragraph;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
    if (cut < max / 2) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = max - 1;
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function chunkPages(pages: readonly PageText[], target = CHUNK_TARGET): Chunk[] {
  const chunks: Chunk[] = [];
  for (const { page, text } of pages) {
    const paragraphs = normalize(text)
      .split(/\n\s*\n|\n(?=[A-ZÀ-Ý0-9•\-–])/)
      .map((p) => p.replace(/\n/g, " ").trim())
      .filter(Boolean)
      .flatMap((p) => splitLong(p, target));

    let current = "";
    const flush = () => {
      if (!current) return;
      const last = chunks.at(-1);
      if (current.length < CHUNK_MIN && last && last.page === page && last.content.length + current.length < target * 1.3) {
        last.content = `${last.content}\n\n${current}`;
      } else {
        chunks.push({ page, content: current });
      }
      current = "";
    };
    for (const paragraph of paragraphs) {
      if (current && current.length + paragraph.length + 2 > target) flush();
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
    flush();
  }
  return chunks;
}
