/**
 * Mode hors ligne partiel : noms partagés avec le service worker
 * (`public/sw.js`, mêmes valeurs, vérifiées par les tests) et effacement des
 * copies gardées sur l'appareil.
 */

export const SERVICE_WORKER_URL = "/sw.js";
export const OFFLINE_PATH = "/hors-ligne";
/** Copies personnelles (pages de l'élève, livres lus), effacées à la déconnexion. */
export const PRIVATE_CACHES = ["atumi-pages", "atumi-livres"] as const;
export const PAGES_CACHE = PRIVATE_CACHES[0];

export type OfflineSection =
  | "dashboard"
  | "courses"
  | "quiz"
  | "tutor"
  | "agenda"
  | "timetable"
  | "search"
  | "library"
  | "help";

const SECTIONS: readonly [string, OfflineSection][] = [
  ["/tableau-de-bord", "dashboard"],
  ["/cours", "courses"],
  ["/quiz", "quiz"],
  ["/professeur", "tutor"],
  ["/agenda", "agenda"],
  ["/emploi-du-temps", "timetable"],
  ["/recherche", "search"],
  ["/bibliotheque", "library"],
  ["/aide", "help"],
];

/** Partie d'ATUMI d'une page gardée, pour la ranger dans la liste hors ligne. */
export function offlineSection(pathname: string): OfflineSection | null {
  for (const [prefix, section] of SECTIONS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return section;
  }
  return null;
}

/** Ordre d'affichage des parties dans la page « Pas de connexion ». */
export const OFFLINE_SECTION_ORDER: readonly OfflineSection[] = SECTIONS.map(([, s]) => s);

/** Efface les pages et livres gardés sur cet appareil (déconnexion, inactivité). */
export async function clearOfflineData(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      await Promise.all(PRIVATE_CACHES.map((name) => caches.delete(name)));
    }
    navigator.serviceWorker?.controller?.postMessage({ type: "atumi-effacer" });
  } catch {
    // Stockage indisponible (navigation privée) : rien n'a été gardé.
  }
}
