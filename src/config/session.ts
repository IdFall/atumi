/**
 * Déconnexion automatique après une période sans activité (décision d'Idrissa,
 * 2026-11-09 : 1 h). Contrôlée deux fois :
 * - dans le navigateur (`IdleSignOut`) : appli ouverte mais inutilisée ;
 * - par le proxy à la requête suivante (cookie `atumi_activite`) : appli fermée
 *   ou téléphone en veille plus d'une heure.
 */
export const INACTIVITY_LIMIT_MS = 60 * 60 * 1000;

/** Cookie (httpOnly) de la dernière requête de l'utilisateur connecté, en millisecondes. */
export const ACTIVITY_COOKIE = "atumi_activite";

/** Clé du navigateur partagée entre onglets : dernière action (toucher, clic, frappe). */
export const ACTIVITY_STORAGE_KEY = "atumi_derniere_activite";

/** Paramètre ajouté à /connexion pour expliquer la déconnexion. */
export const INACTIVE_PARAM = "inactif";

/** Valeur du cookie d'activité : session Supabase et heure, pour ne pas confondre avec une session précédente. */
export function activityCookieValue(sessionId: string, now: number): string {
  return `${sessionId}.${now}`;
}

/**
 * Vrai si la session `sessionId` est restée sans activité plus longtemps que la limite.
 * Cookie absent, illisible ou d'une autre session (nouvelle connexion) : pas expirée.
 */
export function isSessionInactive(cookie: string | undefined, sessionId: string, now: number, limit = INACTIVITY_LIMIT_MS): boolean {
  if (!cookie) return false;
  const dot = cookie.lastIndexOf(".");
  if (dot <= 0 || cookie.slice(0, dot) !== sessionId) return false;
  return isInactive(Number(cookie.slice(dot + 1)), now, limit);
}

/** Vrai si la dernière activité connue date de plus que la limite. Valeur absente ou illisible : pas expirée. */
export function isInactive(lastActivity: number | null | undefined, now: number, limit = INACTIVITY_LIMIT_MS): boolean {
  if (!lastActivity || !Number.isFinite(lastActivity) || lastActivity <= 0) return false;
  return now - lastActivity > limit;
}
