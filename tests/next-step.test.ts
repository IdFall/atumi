import { describe, expect, it } from "vitest";

import { nextStep } from "@/lib/next-step";

describe("étape suivante d'un module", () => {
  it("propose d'importer quand le module est vide ou illisible", () => {
    expect(nextStep([], [])).toEqual({ kind: "import" });
    expect(nextStep([{ status: "failed", chapterId: null }], [])).toEqual({ kind: "import" });
  });

  it("indique la lecture en cours", () => {
    expect(nextStep([{ status: "processing", chapterId: "c1" }], ["c1"])).toEqual({ kind: "reading" });
  });

  it("mène au premier chapitre prêt, dans l'ordre du module", () => {
    const docs = [
      { status: "ready" as const, chapterId: "c2" },
      { status: "ready" as const, chapterId: "c3" },
      { status: "processing" as const, chapterId: "c1" },
    ];
    expect(nextStep(docs, ["c1", "c2", "c3"])).toEqual({ kind: "study", chapterId: "c2" });
  });

  it("mène au module entier quand les documents prêts sont sans chapitre", () => {
    expect(nextStep([{ status: "ready", chapterId: null }], ["c1"])).toEqual({ kind: "study", chapterId: null });
  });
});
