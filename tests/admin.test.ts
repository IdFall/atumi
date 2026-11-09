import { describe, expect, it } from "vitest";

import { formatMoney, majorToMinor, minorToMajor } from "@/lib/money";
import { adminErrorKey, parsePeriod, parsePlanForm } from "@/server/admin/schemas";

function form(values: Record<string, string>) {
  return (name: string) => values[name] ?? "";
}

const base = {
  code: "sn-mois",
  countryCode: "SN",
  label: "Mois",
  price: "3 000",
  durationDays: "30",
  quizLimit: "20",
  documentLimit: "",
  tutorMessageLimit: "100",
  quizQuestionLimit: "10",
  callMinutesLimit: "60",
  isActive: "on",
};

describe("montants", () => {
  it("le franc CFA n'a pas de décimales", () => {
    expect(majorToMinor("3 000", "XOF")).toBe(3000);
    expect(minorToMajor(3000, "XOF")).toBe(3000);
    expect(majorToMinor("12,50", "EUR")).toBe(1250);
    expect(majorToMinor("abc", "XOF")).toBeNull();
    expect(formatMoney(3000, "XOF", "fr-SN")).toMatch(/3\s?000/);
  });
});

describe("formulaire forfait", () => {
  it("lit un forfait ; une limite vide veut dire sans limite", () => {
    const parsed = parsePlanForm(form(base), "XOF");
    expect(parsed).toEqual({
      ok: true,
      plan: {
        code: "sn-mois",
        countryCode: "SN",
        label: "Mois",
        priceMinor: 3000,
        durationDays: 30,
        quizLimit: 20,
        documentLimit: null,
        tutorMessageLimit: 100,
        quizQuestionLimit: 10,
        callMinutesLimit: 60,
        isActive: true,
      },
    });
  });

  it("refuse un code mal formé, une durée nulle ou trop de questions par quiz", () => {
    expect(parsePlanForm(form({ ...base, code: "Mois" }), "XOF")).toEqual({ ok: false, error: "planCode" });
    expect(parsePlanForm(form({ ...base, durationDays: "0" }), "XOF")).toEqual({ ok: false, error: "invalidNumber" });
    expect(parsePlanForm(form({ ...base, quizQuestionLimit: "50" }), "XOF")).toEqual({ ok: false, error: "invalidNumber" });
    expect(parsePlanForm(form({ ...base, quizLimit: "-1" }), "XOF")).toEqual({ ok: false, error: "invalidNumber" });
  });
});

describe("administration", () => {
  it("traduit les refus de la base", () => {
    expect(adminErrorKey({ message: "ATUMI_ADMIN_REFUSE" })).toBe("refused");
    expect(adminErrorKey({ message: "duplicate key", code: "23505" })).toBe("duplicateReference");
    expect(adminErrorKey(null)).toBe("unknown");
  });

  it("période par défaut : 30 jours", () => {
    expect(parsePeriod("7")).toBe("7");
    expect(parsePeriod("365")).toBe("30");
    expect(parsePeriod(undefined)).toBe("30");
  });
});
