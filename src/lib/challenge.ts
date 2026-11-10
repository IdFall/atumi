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

/** WhatsApp Web, pour un ordinateur sans l'application WhatsApp. */
export function whatsappWebShareUrl(text: string): string {
  return `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/** Logo WhatsApp (tracé SVG 24 × 24). */
export const WHATSAPP_ICON =
  "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2z";

/** Téléphone ou tablette : le menu de partage du système mène à WhatsApp. */
export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
}
