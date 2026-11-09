import { describe, expect, it } from "vitest";

import { calculate } from "@/lib/calculator";
import { ELEMENTS, elementPosition } from "@/lib/periodic-table";
import { convert } from "@/lib/units";

const value = (input: string, angle: "deg" | "rad" = "deg") => {
  const r = calculate(input, angle);
  return r.ok ? r.value : r.error;
};

describe("calculatrice", () => {
  it("respecte les priorités et les parenthèses", () => {
    expect(value("2 + 3 × 4")).toBe(14);
    expect(value("(2 + 3) * 4")).toBe(20);
    expect(value("2^3^2")).toBe(512);
    expect(value("-2^2")).toBe(-4);
    expect(value("0,1 + 0,2")).toBe(0.3);
    expect(value("10 ÷ 4")).toBe(2.5);
    expect(value("50 % * 30")).toBe(15);
  });

  it("connaît fonctions, constantes et multiplication implicite", () => {
    expect(value("sin(30)")).toBe(0.5);
    expect(value("cos(pi)", "rad")).toBe(-1);
    expect(value("sin(180)")).toBe(0);
    expect(value("√16 + sqrt(9)")).toBe(7);
    expect(value("2π")).toBe(6.28318530718);
    expect(value("3(4+1)")).toBe(15);
    expect(value("ln(e)")).toBe(1);
    expect(value("log(1000)")).toBe(3);
    expect(value("5!")).toBe(120);
    expect(value("1,5e3 + 2e-1")).toBe(1500.2);
  });

  it("signale les erreurs sans planter", () => {
    expect(value("1 / 0")).toBe("domain");
    expect(value("sqrt(-1)")).toBe("domain");
    expect(value("tan(90)")).toBe("domain");
    expect(value("2 +")).toBe("syntax");
    expect(value("(1 + 2")).toBe("syntax");
    expect(value("alert(1)")).toBe("syntax");
    expect(value("")).toBe("syntax");
  });
});

describe("conversions", () => {
  it("convertit dans une même grandeur", () => {
    expect(convert(1, "length", "km", "m")).toBe(1000);
    expect(convert(90, "speed", "km/h", "m/s")).toBe(25);
    expect(convert(1, "volume", "L", "cm³")).toBe(1000);
    expect(convert(2, "time", "h", "min")).toBe(120);
    expect(convert(1, "energy", "kcal", "kJ")).toBe(4.184);
  });

  it("convertit les températures", () => {
    expect(convert(100, "temperature", "°C", "°F")).toBe(212);
    expect(convert(0, "temperature", "K", "°C")).toBe(-273.15);
  });

  it("refuse une unité inconnue", () => {
    expect(convert(1, "length", "kg", "m")).toBeNull();
  });
});

describe("tableau périodique", () => {
  it("contient les 118 éléments, dans l'ordre", () => {
    expect(ELEMENTS).toHaveLength(118);
    ELEMENTS.forEach((e, i) => expect(e.z).toBe(i + 1));
    expect(new Set(ELEMENTS.map((e) => e.symbol)).size).toBe(118);
  });

  it("place les éléments à leur case", () => {
    const at = (symbol: string) => elementPosition(ELEMENTS.find((e) => e.symbol === symbol)!.z);
    expect(at("H")).toEqual({ row: 1, column: 1 });
    expect(at("He")).toEqual({ row: 1, column: 18 });
    expect(at("Fe")).toEqual({ row: 4, column: 8 });
    expect(at("La")).toEqual({ row: 9, column: 3 });
    expect(at("Lu")).toEqual({ row: 9, column: 17 });
    expect(at("U")).toEqual({ row: 10, column: 6 });
    expect(at("Og")).toEqual({ row: 7, column: 18 });
    // Une seule case par position.
    const cells = ELEMENTS.map((e) => JSON.stringify(elementPosition(e.z)));
    expect(new Set(cells).size).toBe(118);
  });
});
