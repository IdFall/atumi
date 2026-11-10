/** Initiales affichées quand l'élève n'a pas de photo de profil. */
export function initialsOf(username: string): string {
  const parts = username
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[1][0]}`;
  return letters.toUpperCase();
}

/** Côté de la photo de profil enregistrée, en pixels (carré). */
export const AVATAR_SIDE = 384;
