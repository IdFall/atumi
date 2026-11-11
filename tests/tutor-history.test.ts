import { describe, expect, it } from "vitest";

import { historyFilter, modesForFilter } from "../src/lib/tutor-history";

describe("historique du Prof filtré par mode", () => {
  it("suit l'onglet ouvert, Approfondir rangé avec Explication", () => {
    expect(historyFilter("", "exercer")).toBe("exercer");
    expect(historyFilter("", "approfondir")).toBe("expliquer");
    expect(historyFilter("autre", "decouvrir")).toBe("decouvrir");
  });

  it("garde le filtre choisi, dont « Tous »", () => {
    expect(historyFilter("tous", "expliquer")).toBe("tous");
    expect(historyFilter("exercer", "expliquer")).toBe("exercer");
  });

  it("donne les modes de conversation de chaque filtre", () => {
    expect(modesForFilter("tous")).toBeNull();
    expect(modesForFilter("expliquer")).toEqual(["expliquer", "approfondir"]);
    expect(modesForFilter("decouvrir")).toEqual(["decouvrir"]);
  });
});
