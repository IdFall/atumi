import { describe, expect, it } from "vitest";

import {
  activeCountries,
  countryFromPhone,
  isCycleOpen,
  isTutorLanguageOffered,
  requiresParentalConsent,
  toE164,
} from "@/config/countries";

describe("pays", () => {
  it("n'ouvre que le Sénégal au lancement", () => {
    expect(activeCountries().map((c) => c.code)).toEqual(["SN"]);
  });

  it("normalise les numéros au format international", () => {
    expect(toE164("77 123 45 67", "SN")).toBe("+221771234567");
    expect(toE164("+221 77 123 45 67", "SN")).toBe("+221771234567");
    expect(toE164("00221771234567", "SN")).toBe("+221771234567");
    expect(toE164("abc", "SN")).toBeNull();
  });

  it("retrouve le pays depuis l'indicatif", () => {
    expect(countryFromPhone("+221771234567")?.code).toBe("SN");
    expect(countryFromPhone("+2250701020304")?.code).toBe("CI");
  });

  it("n'ouvre que le lycée et l'université en V1", () => {
    expect(isCycleOpen("SN", "lycee")).toBe(true);
    expect(isCycleOpen("SN", "universite")).toBe(true);
    expect(isCycleOpen("SN", "college")).toBe(false);
    expect(isCycleOpen("SN", "maternelle")).toBe(false);
  });

  it("propose le français et l'anglais au Sénégal, le wolof restant en attente", () => {
    expect(isTutorLanguageOffered("SN", "fr")).toBe(true);
    expect(isTutorLanguageOffered("SN", "en")).toBe(true);
    expect(isTutorLanguageOffered("SN", "wo")).toBe(false);
    expect(isTutorLanguageOffered("CI", "wo")).toBe(false);
  });

  it("exige le consentement parental pour le collège et le lycée", () => {
    expect(requiresParentalConsent("college")).toBe(true);
    expect(requiresParentalConsent("lycee")).toBe(true);
    expect(requiresParentalConsent("universite")).toBe(false);
  });
});
