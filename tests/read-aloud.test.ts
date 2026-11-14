import { describe, expect, it } from "vitest";

import { normalizeReadText, READ_CHUNK_MAX, splitForReading } from "@/lib/read-aloud";

describe("lecture audio : découpage du texte", () => {
  it("nettoie les espaces et recolle les mots coupés en fin de ligne", () => {
    expect(normalizeReadText("  Le théo-\nrème   de\nThalès  ")).toBe("Le théorème de Thalès");
  });

  it("rien à lire pour un texte vide (PDF scanné)", () => {
    expect(splitForReading("   \n ")).toEqual([]);
  });

  it("coupe entre les phrases sans dépasser la longueur maximale", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Phrase numéro ${i} du cours.`).join(" ");
    const chunks = splitForReading(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(READ_CHUNK_MAX);
      expect(chunk.endsWith(".")).toBe(true);
    }
    expect(chunks.join(" ")).toBe(normalizeReadText(text));
  });

  it("coupe une phrase trop longue entre deux mots", () => {
    const long = Array.from({ length: 120 }, () => "mot").join(" ");
    const chunks = splitForReading(long, 50);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(50);
    expect(chunks.join(" ")).toBe(long);
  });
});
