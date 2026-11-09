/**
 * Conversions d'unités de la boîte à outils. Chaque unité est définie par son
 * facteur vers l'unité de base de sa grandeur ; la température a ses formules.
 */

export const QUANTITIES = ["length", "mass", "time", "area", "volume", "speed", "temperature", "energy", "pressure"] as const;
export type Quantity = (typeof QUANTITIES)[number];

/** Symbole → facteur vers l'unité de base (m, kg, s, m², m³, m/s, J, Pa). */
export const UNITS: Record<Exclude<Quantity, "temperature">, Record<string, number>> = {
  length: { km: 1000, m: 1, dm: 0.1, cm: 0.01, mm: 0.001, "µm": 1e-6, nm: 1e-9, mi: 1609.344, ft: 0.3048, in: 0.0254 },
  mass: { t: 1000, kg: 1, g: 0.001, mg: 1e-6, "µg": 1e-9, lb: 0.45359237 },
  time: { an: 31_557_600, j: 86_400, h: 3600, min: 60, s: 1, ms: 0.001 },
  area: { "km²": 1e6, ha: 1e4, a: 100, "m²": 1, "dm²": 0.01, "cm²": 1e-4, "mm²": 1e-6 },
  volume: { "m³": 1, hL: 0.1, "dm³": 0.001, L: 0.001, dL: 1e-4, cL: 1e-5, mL: 1e-6, "cm³": 1e-6 },
  speed: { "m/s": 1, "km/h": 1 / 3.6, nœud: 1852 / 3600, mph: 0.44704 },
  energy: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3.6e6, eV: 1.602176634e-19 },
  pressure: { Pa: 1, hPa: 100, kPa: 1000, bar: 1e5, atm: 101_325, mmHg: 133.322 },
};

export const TEMPERATURE_UNITS = ["°C", "K", "°F"] as const;
type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number];

export function unitsOf(quantity: Quantity): string[] {
  return quantity === "temperature" ? [...TEMPERATURE_UNITS] : Object.keys(UNITS[quantity]);
}

function toKelvin(value: number, unit: TemperatureUnit): number {
  if (unit === "K") return value;
  if (unit === "°C") return value + 273.15;
  return ((value - 32) * 5) / 9 + 273.15;
}

function fromKelvin(kelvin: number, unit: TemperatureUnit): number {
  if (unit === "K") return kelvin;
  if (unit === "°C") return kelvin - 273.15;
  return ((kelvin - 273.15) * 9) / 5 + 32;
}

/** Valeur convertie, arrondie à 10 chiffres significatifs ; `null` si l'unité est inconnue. */
export function convert(value: number, quantity: Quantity, from: string, to: string): number | null {
  if (!Number.isFinite(value)) return null;
  let result: number;
  if (quantity === "temperature") {
    const units = TEMPERATURE_UNITS as readonly string[];
    if (!units.includes(from) || !units.includes(to)) return null;
    result = fromKelvin(toKelvin(value, from as TemperatureUnit), to as TemperatureUnit);
  } else {
    const table = UNITS[quantity];
    if (!(from in table) || !(to in table)) return null;
    result = (value * table[from]) / table[to];
  }
  const rounded = Number(result.toPrecision(10));
  return Math.abs(rounded) < 1e-300 ? 0 : rounded;
}
