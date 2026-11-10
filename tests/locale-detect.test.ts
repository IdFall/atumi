import { describe, expect, it } from "vitest";

import { localeForCountry } from "@/config/countries";
import { detectLocale, fromAcceptLanguage } from "@/lib/locale-detect";

describe("langue par défaut de l'interface", () => {
  it("suit le pays : français en pays francophone, anglais en pays anglophone", () => {
    expect(localeForCountry("SN")).toBe("fr");
    expect(localeForCountry("ci")).toBe("fr");
    expect(localeForCountry("GM")).toBe("en");
    expect(localeForCountry("NG")).toBe("en");
    expect(localeForCountry("XX")).toBeNull();
    expect(localeForCountry(null)).toBeNull();
  });

  it("prend la langue du navigateur quand le pays est inconnu", () => {
    expect(fromAcceptLanguage("en-US,en;q=0.9,fr;q=0.8")).toBe("en");
    expect(fromAcceptLanguage("de-DE,de;q=0.9,fr;q=0.7,en;q=0.8")).toBe("en");
    expect(fromAcceptLanguage("es,pt")).toBeNull();
    expect(fromAcceptLanguage(null)).toBeNull();
  });

  it("le pays passe avant le navigateur, le français en dernier recours", () => {
    expect(detectLocale({ country: "SN", acceptLanguage: "en-US" })).toBe("fr");
    expect(detectLocale({ country: "GH", acceptLanguage: "fr-FR" })).toBe("en");
    expect(detectLocale({ country: null, acceptLanguage: "en-GB" })).toBe("en");
    expect(detectLocale({ country: "XX", acceptLanguage: "es" })).toBe("fr");
  });
});
