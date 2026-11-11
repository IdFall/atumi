import type { TutorMode } from "@/server/ai/prompts";

/** Filtres de « Mes dernières questions » : un par onglet du Prof, plus « Tous ». */
export const HISTORY_FILTERS = ["tous", "expliquer", "exercer", "decouvrir"] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

/** Filtre demandé dans l'adresse, sinon celui de l'onglet ouvert (Approfondir va avec Explication). */
export function historyFilter(requested: string, mode: TutorMode): HistoryFilter {
  if ((HISTORY_FILTERS as readonly string[]).includes(requested)) return requested as HistoryFilter;
  return mode === "approfondir" ? "expliquer" : mode;
}

/** Modes de conversation affichés pour un filtre ; `null` = tous. */
export function modesForFilter(filter: HistoryFilter): TutorMode[] | null {
  if (filter === "tous") return null;
  return filter === "expliquer" ? ["expliquer", "approfondir"] : [filter];
}
