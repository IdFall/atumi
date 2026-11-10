/**
 * Notion absente du cours : quand l'élève demande une explication sur un mot
 * ou une notion qui n'est pas dans ses documents, le Prof ATUM le lui dit et
 * propose deux boutons qui lancent tout de suite la recherche, sans ressaisie :
 * « Recherche web (IA) » (avec sources, compte comme une recherche web) et
 * « Encyclopédie » (Wikipédia, sans IA ni forfait).
 *
 * L'information est gardée dans les citations du message du professeur.
 */

export interface OutsideCourse {
  /** Mot ou notion, pour l'encyclopédie. */
  outsideTerm: string;
  /** Question de l'élève, pour la recherche web. */
  question: string;
}

export function isOutsideCitation(c: unknown): c is OutsideCourse {
  return (
    !!c &&
    typeof c === "object" &&
    typeof (c as { outsideTerm?: unknown }).outsideTerm === "string" &&
    typeof (c as { question?: unknown }).question === "string"
  );
}

/** Ligne que le modèle écrit en tête de réponse quand la notion n'est pas dans le cours. */
const MARKER = /^\s*\[hors[\s-]?cours\s*:\s*([^\]\n]{1,80})\]\s*\n*/i;

/** Retire la ligne `[hors-cours: notion]` de la réponse du modèle et rend la notion. */
export function extractOutsideMarker(text: string): { text: string; term: string | null } {
  const match = MARKER.exec(text);
  if (!match) return { text, term: null };
  return { text: text.slice(match[0].length).trimStart(), term: match[1].trim() || null };
}

const LEADS: readonly RegExp[] = [
  /^(?:bonjour|salut|bonsoir|hello|hi)[\s,!.]+/i,
  /^(?:s'il te pla[iî]t|stp|please)[\s,]+/i,
  /^(?:est-ce que tu peux|peux-tu|pourrais-tu|tu peux|can you|could you)\s+/i,
  /^(?:m'expliquer|m'explique|explique[rsz]?)(?:-moi|\s+moi)?\s+/i,
  /^(?:explain(?:\s+to\s+me)?|tell me about|define)\s+/i,
  /^(?:c'est quoi|qu'est-ce que c'est que|qu'est-ce que c'est|qu'est-ce que|qu'est ce que|que veut dire|que signifie|que sont|qui est|qui était|définition de|définis|what is|what are|who is|who was|meaning of)(?:\s+|$)/i,
  /^(?:qu'est-ce qu'|qu'est ce qu'|définition d'|ce qu'est|ce qu'on appelle|la notion d'|le concept d')\s*/i,
  /^(?:ce que sont|ce que veut dire|la notion de|le concept de|le mot)(?:\s+|$)/i,
  /^(?:les|le|la|un|une|des|du|de la|the|a|an)\s+/i,
  /^(?:l'|de l'|d')\s*/i,
];

/** Mot ou notion tiré d'une question (« C'est quoi la photosynthèse ? » → « photosynthèse »). */
export function conceptOf(question: string): string {
  let text = question.trim().replace(/[’]/g, "'");
  for (let changed = true; changed; ) {
    changed = false;
    for (const lead of LEADS) {
      const next = text.replace(lead, "");
      if (next !== text) {
        text = next.trim();
        changed = true;
      }
    }
  }
  text = text
    .replace(/\s*(?:s'il te pla[iî]t|stp|please)\s*$/i, "")
    .replace(/[\s?!.;:,]+$/, "")
    .trim();
  const term = text || question.trim();
  return term.length > 60 ? `${term.slice(0, 60).trimEnd()}…` : term;
}

/** Liens qui lancent la recherche tout de suite, sans ressaisie. */
export function outsideLinks(c: OutsideCourse): { web: string; encyclopedia: string } {
  return {
    web: `/recherche?onglet=web&lancer=${encodeURIComponent(c.question.slice(0, 500))}`,
    encyclopedia: `/recherche?onglet=outils&encyclopedie=${encodeURIComponent(c.outsideTerm.slice(0, 100))}`,
  };
}
