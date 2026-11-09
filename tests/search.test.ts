import { describe, expect, it } from "vitest";

import { cleanQuery, containsPattern, excerpt } from "@/lib/search";

describe("recherche dans les cours", () => {
  it("nettoie la requête", () => {
    expect(cleanQuery("  théorème   de  Pythagore ")).toBe("théorème de Pythagore");
    expect(cleanQuery("a")).toBeNull();
    expect(cleanQuery(undefined)).toBeNull();
    expect(cleanQuery("x".repeat(300))).toHaveLength(100);
  });

  it("échappe les caractères spéciaux du motif", () => {
    expect(containsPattern("50%_a\\b")).toBe("%50\\%\\_a\\\\b%");
  });

  it("surligne le mot trouvé, sans tenir compte des accents ni des majuscules", () => {
    const parts = excerpt("Le théorème de Pythagore relie les côtés.", "THEOREME pythagore");
    expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual(["théorème", "Pythagore"]);
    expect(parts.map((p) => p.text).join("")).toBe("Le théorème de Pythagore relie les côtés.");
  });

  it("ne surligne ni les petits mots ni l'intérieur des mots", () => {
    const parts = excerpt("Le théorème de Pythagore et des idées deux fois", "théorème de pythagore");
    expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual(["théorème", "Pythagore"]);
    expect(excerpt("Les théorèmes du cours", "théorème").filter((p) => p.match).map((p) => p.text)).toEqual(["théorème"]);
    expect(excerpt("un mot de plus", "de").filter((p) => p.match).map((p) => p.text)).toEqual(["de"]);
  });

  it("centre l'extrait sur le mot et marque les coupures", () => {
    const content = `${"a ".repeat(200)}photosynthèse ${"b ".repeat(200)}`;
    const parts = excerpt(content, "photosynthese", 60);
    expect(parts[0].text).toBe("…");
    expect(parts.at(-1)?.text).toBe("…");
    expect(parts.some((p) => p.match && p.text === "photosynthèse")).toBe(true);
  });
});
