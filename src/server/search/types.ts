/** Résultats de la recherche dans les cours (partagés par le serveur et l'affichage). */

export interface SearchResults {
  modules: { id: string; name: string }[];
  chapters: { id: string; title: string; moduleId: string; moduleName: string | null }[];
  documents: { id: string; title: string; moduleId: string }[];
  passages: { id: number; documentId: string; documentTitle: string; moduleId: string; page: number | null; content: string }[];
  events: { id: string; title: string; dueOn: string }[];
}

export function isEmpty(r: SearchResults): boolean {
  return !r.modules.length && !r.chapters.length && !r.documents.length && !r.passages.length && !r.events.length;
}
