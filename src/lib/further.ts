/**
 * « Pour aller plus loin » : sous une explication du Prof ATUM tirée du cours
 * (modes Explication et Approfondir), l'élève peut demander une suite appuyée
 * sur d'autres sources crédibles du web. Cette suite est gardée comme un
 * message du professeur dont les citations sont des pages web.
 */

/** Modes où l'explication vient du cours et peut être prolongée. */
export const FURTHER_MODES = ["expliquer", "approfondir"] as const;

/** Source citée par un message : passage du cours ou page web. */
export type MessageCitation = { page: number | null; documentTitle: string } | { url: string; title: string };

export function isWebCitation(c: unknown): c is { url: string; title: string } {
  return (
    !!c &&
    typeof c === "object" &&
    typeof (c as { url?: unknown }).url === "string" &&
    /^https:\/\/[^\s"'<>]+$/.test((c as { url: string }).url) &&
    typeof (c as { title?: unknown }).title === "string"
  );
}

/** Vrai pour un message « Pour aller plus loin » (il cite des pages web). */
export function isFurtherMessage(m: { role: string; citations: readonly unknown[] }): boolean {
  return m.role === "assistant" && m.citations.some(isWebCitation);
}

/**
 * Le bouton s'affiche sous la dernière réponse du professeur quand elle est
 * une explication du cours (pas déjà une suite « plus loin »).
 */
export function canExploreFurther(mode: string, messages: readonly { role: string; content: string; citations: readonly unknown[] }[]): boolean {
  if (!(FURTHER_MODES as readonly string[]).includes(mode)) return false;
  const last = messages.at(-1);
  if (!last || last.role !== "assistant" || isFurtherMessage(last)) return false;
  return messages.slice(0, -1).some((m) => m.role === "user");
}
