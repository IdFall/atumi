import { describe, expect, it } from "vitest";

import { activeCountries, countryFromPhone, requiresParentalConsent, toE164 } from "@/config/countries";

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

  it("exige le consentement parental pour le collège et le lycée", () => {
    expect(requiresParentalConsent("college")).toBe(true);
    expect(requiresParentalConsent("lycee")).toBe(true);
    expect(requiresParentalConsent("universite")).toBe(false);
  });
});
