/**
 * Partage d'un texte par WhatsApp : le texte part en entier dans le lien s'il
 * est court ; sinon le début seulement, suivi d'un lien « Lire la suite » vers
 * la page publique du texte complet (/partage/<id>).
 */

/** Au-delà, un lien WhatsApp risque de ne pas s'ouvrir sur certains téléphones. */
export const WHATSAPP_MAX_CHARS = 3500;

/** Longueur du début du texte quand il faut renvoyer vers la suite. */
export const SHARE_EXCERPT_CHARS = 1200;

export function needsSharePage(text: string): boolean {
  return text.length > WHATSAPP_MAX_CHARS;
}

/** Début du texte, coupé sur un espace quand c'est possible. */
export function shareExcerpt(text: string, max = SHARE_EXCERPT_CHARS): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.8 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function sharePath(shareId: string): string {
  return `/partage/${shareId}`;
}

/** Message WhatsApp d'un long texte : le début, puis « Lire la suite » et le lien. */
export function readMoreMessage(text: string, readMoreLabel: string, url: string): string {
  return `${shareExcerpt(text)}\n\n${readMoreLabel} 👉 ${url}`;
}
