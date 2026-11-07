/** Adresse de la page Synthèse d'un chapitre, ou du module entier. */
export function studyPath(moduleId: string, chapterId: string | null): string {
  return `/cours/${moduleId}/synthese${chapterId ? `?chapitre=${chapterId}` : ""}`;
}
