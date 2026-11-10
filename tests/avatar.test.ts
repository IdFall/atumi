import { describe, expect, it } from "vitest";

import { initialsOf } from "@/lib/avatar";

describe("initiales de la photo de profil", () => {
  it("prend les deux premières lettres ou les initiales de deux mots", () => {
    expect(initialsOf("awa")).toBe("AW");
    expect(initialsOf("awa_diop")).toBe("AD");
    expect(initialsOf("Élodie N.")).toBe("ÉN");
    expect(initialsOf("__")).toBe("?");
  });
});
