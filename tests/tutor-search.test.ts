import { describe, expect, it } from "vitest";

import { buildSearchQuery } from "@/server/tutor/search";

describe("recherche des passages pour le professeur", () => {
  it("garde les mots importants de la question, reliés par « or »", () => {
    expect(buildSearchQuery("Comment calculer une intégrale par parties ?")).toBe("calculer or intégrale or parties");
  });

  it("ignore une question sans mot utile et limite le nombre de termes", () => {
    expect(buildSearchQuery("et ça ?")).toBeNull();
    expect(buildSearchQuery("un deux trois quatre cinq six sept huit neuf dix onze", 3)).toBe("deux or trois or quatre");
  });

  it("neutralise la syntaxe de recherche dans la question", () => {
    expect(buildSearchQuery('"primitive" -ln OR (x)')).toBe("primitive");
  });
});
