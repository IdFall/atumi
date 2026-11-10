/**
 * Défi quiz entre amis : calculs sans dépendance (testés à part).
 * Le lien du défi est /defi/<identifiant aléatoire du défi>.
 */

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
