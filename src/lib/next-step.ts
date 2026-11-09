/**
 * Prochaine étape conseillée pour un module dans « Mes cours » :
 * importer un cours, attendre sa lecture, ou lancer la synthèse et le quiz.
 */
export type DocumentState = "uploaded" | "processing" | "ready" | "failed";

export type NextStep =
  | { kind: "import" }
  | { kind: "reading" }
  | { kind: "study"; chapterId: string | null };

export function nextStep(
  documents: readonly { status: DocumentState; chapterId: string | null }[],
  chapterOrder: readonly string[],
): NextStep {
  const ready = documents.filter((d) => d.status === "ready");
  if (ready.length > 0) {
    // Premier chapitre (dans l'ordre du module) qui a un document prêt, sinon le module entier.
    const readyChapters = new Set(ready.map((d) => d.chapterId));
    const chapterId = chapterOrder.find((id) => readyChapters.has(id)) ?? null;
    return { kind: "study", chapterId };
  }
  if (documents.some((d) => d.status === "uploaded" || d.status === "processing")) return { kind: "reading" };
  return { kind: "import" };
}
