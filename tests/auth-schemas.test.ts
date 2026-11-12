import { describe, expect, it } from "vitest";

import { getCountry } from "@/config/countries";
import { parseIdentifier, parseSignIn, parseSignUp } from "@/server/auth/schemas";

const base = {
  username: "Awa_Diop",
  identifier: "awa@exemple.sn",
  password: "motdepasse",
  cycle: "universite",
  age: "20",
  acceptCgu: "on",
};

describe("identifiant", () => {
  it("reconnaît un e-mail ou un numéro", () => {
    expect(parseIdentifier(" Awa@Exemple.SN ", "SN")).toEqual({ kind: "email", email: "awa@exemple.sn" });
    expect(parseIdentifier("77 123 45 67", "SN")).toEqual({ kind: "phone", phone: "+221771234567" });
    expect(parseIdentifier("pas un identifiant", "SN")).toBeNull();
    expect(parseIdentifier("awa@", "SN")).toBeNull();
  });
});

describe("inscription", () => {
  it("accepte un étudiant et met le pseudo en minuscules", () => {
    const result = parseSignUp(base, "SN");
    expect(result).toEqual({
      ok: true,
      data: {
        username: "awa_diop",
        identifier: { kind: "email", email: "awa@exemple.sn" },
        password: "motdepasse",
        cycle: "universite",
        role: "eleve",
        countryCode: "SN",
        guardianPhone: null,
        age: 20,
        isAdult: true,
      },
    });
  });

  it("un lycéen de 18 ans ou plus n'a pas besoin du numéro d'un parent", () => {
    const adult = parseSignUp({ ...base, cycle: "lycee", age: "18" }, "SN");
    expect(adult.ok && adult.data).toMatchObject({ guardianPhone: null, age: 18, isAdult: true });
  });

  it("exige un âge valable", () => {
    expect(parseSignUp({ ...base, age: "" }, "SN")).toEqual({ ok: false, errors: { age: "ageRequired" } });
    for (const bad of ["douze", "-3", "2", "150", "17.5"]) {
      expect(parseSignUp({ ...base, age: bad }, "SN")).toEqual({ ok: false, errors: { age: "ageInvalid" } });
    }
    expect(parseSignUp({ ...base, age: " 25 " }, "SN").ok).toBe(true);
  });

  it("un élève mineur donne le numéro d'un parent, quel que soit son niveau", () => {
    const missing = parseSignUp({ ...base, age: "17" }, "SN");
    expect(missing).toEqual({ ok: false, errors: { guardianPhone: "guardianPhoneRequired" } });
    const ok = parseSignUp({ ...base, age: "17", guardianPhone: "77 000 00 00" }, "SN");
    expect(ok.ok && ok.data).toMatchObject({ age: 17, isAdult: false, guardianPhone: "+221770000000" });
  });

  it("pays qui ferme l'inscription aux mineurs : refus avec le message pour un parent", () => {
    const sn = getCountry("SN") as { minorSignUp: string };
    const before = sn.minorSignUp;
    sn.minorSignUp = "closed";
    try {
      const result = parseSignUp({ ...base, cycle: "lycee", age: "16", guardianPhone: "77 000 00 00" }, "SN");
      expect(result).toEqual({ ok: false, errors: { age: "minorClosed" } });
      expect(parseSignUp({ ...base, cycle: "lycee", age: "18" }, "SN").ok).toBe(true);
    } finally {
      sn.minorSignUp = before;
    }
  });

  it("un compte enseignant est réservé aux majeurs", () => {
    const result = parseSignUp({ ...base, role: "enseignant", age: "16", guardianPhone: "77 000 00 00" }, "SN");
    expect(result).toEqual({ ok: false, errors: { age: "teacherMinor" } });
  });

  it("un enseignant au lycée n'a pas besoin du numéro d'un parent", () => {
    const teacher = parseSignUp({ ...base, cycle: "lycee", role: "enseignant" }, "SN");
    expect(teacher.ok && teacher.data).toMatchObject({ role: "enseignant", cycle: "lycee", guardianPhone: null });
    // Primaire et école supérieure : pour un enseignant seulement.
    const primary = parseSignUp({ ...base, cycle: "primaire", role: "enseignant" }, "SN");
    expect(primary.ok && primary.data).toMatchObject({ role: "enseignant", cycle: "primaire", guardianPhone: null });
    expect(parseSignUp({ ...base, cycle: "ecole_superieure", role: "enseignant" }, "SN").ok).toBe(true);
    expect(parseSignUp({ ...base, cycle: "primaire" }, "SN")).toEqual({ ok: false, errors: { cycle: "cycleNotOpen" } });
    // Valeur inconnue : élève.
    const other = parseSignUp({ ...base, role: "admin" }, "SN");
    expect(other.ok && other.data.role).toBe("eleve");
  });

  it("exige le numéro d'un parent pour un lycéen mineur", () => {
    const missing = parseSignUp({ ...base, cycle: "lycee", age: "16" }, "SN");
    expect(missing).toEqual({ ok: false, errors: { guardianPhone: "guardianPhoneRequired" } });

    const ok = parseSignUp({ ...base, cycle: "lycee", age: "16", guardianPhone: "77 000 00 00" }, "SN");
    expect(ok.ok && ok.data.guardianPhone).toBe("+221770000000");
  });

  it("refuse que le parent ait le même numéro que l'élève", () => {
    const result = parseSignUp(
      { ...base, identifier: "771234567", cycle: "lycee", age: "15", guardianPhone: "+221771234567" },
      "SN",
    );
    expect(result).toEqual({ ok: false, errors: { guardianPhone: "guardianPhoneSameAsUser" } });
  });

  it("refuse le collège, pas encore ouvert en V1", () => {
    const result = parseSignUp({ ...base, cycle: "college", guardianPhone: "77 000 00 00" }, "SN");
    expect(result).toEqual({ ok: false, errors: { cycle: "cycleNotOpen" } });
  });

  it("refuse un numéro d'un pays pas encore ouvert", () => {
    const result = parseSignUp({ ...base, identifier: "+2250701020304" }, "SN");
    expect(result).toEqual({ ok: false, errors: { identifier: "countryNotOpen" } });
  });

  it("signale chaque champ invalide", () => {
    const result = parseSignUp({ username: "a", identifier: "", password: "court", cycle: "", acceptCgu: null }, "SN");
    expect(result).toEqual({
      ok: false,
      errors: {
        username: "usernameInvalid",
        identifier: "identifierInvalid",
        password: "passwordLength",
        age: "ageRequired",
        cycle: "cycleRequired",
        acceptCgu: "cguRequired",
      },
    });
  });
});

describe("connexion", () => {
  it("exige un identifiant valide et un mot de passe", () => {
    expect(parseSignIn({ identifier: "x", password: "" }, "SN")).toEqual({
      ok: false,
      errors: { identifier: "identifierInvalid", password: "passwordRequired" },
    });
    expect(parseSignIn({ identifier: "771234567", password: "secret123" }, "SN").ok).toBe(true);
  });
});
