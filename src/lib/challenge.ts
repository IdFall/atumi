/**
 * Défi quiz entre amis : calculs sans dépendance (testés à part).
 * Le lien du défi est /defi/<identifiant aléatoire du défi>.
 */

/** Durée d'un défi, relancé pour la même durée à chaque nouveau partage. */
export const CHALLENGE_DAYS = 7;

/** Longueur maximale du prénom ou surnom de l'ami. */
export const PLAYER_NAME_MAX = 20;

/** Un défi est ouvert tant que l'élève ne l'a pas arrêté et que ses 7 jours ne sont pas passés. */
export function isChallengeOpen(challenge: { closed_at: string | null; expires_at: string }, now: number): boolean {
  return challenge.closed_at === null && Date.parse(challenge.expires_at) > now;
}

/** Prénom de l'ami : espaces resserrés, 20 caractères au plus ; null s'il est vide. */
export function cleanPlayerName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, PLAYER_NAME_MAX).trim();
  return name.length > 0 ? name : null;
}

export type ChallengeOutcome = "win" | "draw" | "lose";

/** Issue du défi pour l'ami, comparée au score de l'élève qui l'a lancé. */
export function challengeOutcome(mine: number, theirs: number): ChallengeOutcome {
  if (mine > theirs) return "win";
  return mine === theirs ? "draw" : "lose";
}

/** Bonnes réponses de l'élève, retrouvées depuis son score enregistré (0 à 1). */
export function correctFromScore(score: number | string | null, total: number): number {
  const value = Number(score);
  if (!Number.isFinite(value) || total <= 0) return 0;
  return Math.min(total, Math.max(0, Math.round(value * total)));
}

export function challengePath(challengeId: string): string {
  return `/defi/${challengeId}`;
}

/** Lien WhatsApp de secours quand le téléphone n'a pas de menu de partage. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
