/**
 * Tableau périodique de la boîte à outils : 118 éléments (symbole, noms
 * français et anglais, masse atomique en g/mol, famille) et leur case.
 * Masses arrondies (IUPAC) ; pour les éléments radioactifs sans masse
 * standard, nombre de masse de l'isotope le plus stable.
 */

export const ELEMENT_CATEGORIES = [
  "alkali",
  "alkalineEarth",
  "transition",
  "postTransition",
  "metalloid",
  "nonMetal",
  "halogen",
  "nobleGas",
  "lanthanide",
  "actinide",
] as const;
export type ElementCategory = (typeof ELEMENT_CATEGORIES)[number];

export interface Element {
  z: number;
  symbol: string;
  name: { fr: string; en: string };
  mass: number;
  category: ElementCategory;
}

const DATA: readonly [string, string, string, number, ElementCategory][] = [
  ["H", "Hydrogène", "Hydrogen", 1.008, "nonMetal"],
  ["He", "Hélium", "Helium", 4.0026, "nobleGas"],
  ["Li", "Lithium", "Lithium", 6.94, "alkali"],
  ["Be", "Béryllium", "Beryllium", 9.0122, "alkalineEarth"],
  ["B", "Bore", "Boron", 10.81, "metalloid"],
  ["C", "Carbone", "Carbon", 12.011, "nonMetal"],
  ["N", "Azote", "Nitrogen", 14.007, "nonMetal"],
  ["O", "Oxygène", "Oxygen", 15.999, "nonMetal"],
  ["F", "Fluor", "Fluorine", 18.998, "halogen"],
  ["Ne", "Néon", "Neon", 20.180, "nobleGas"],
  ["Na", "Sodium", "Sodium", 22.990, "alkali"],
  ["Mg", "Magnésium", "Magnesium", 24.305, "alkalineEarth"],
  ["Al", "Aluminium", "Aluminium", 26.982, "postTransition"],
  ["Si", "Silicium", "Silicon", 28.085, "metalloid"],
  ["P", "Phosphore", "Phosphorus", 30.974, "nonMetal"],
  ["S", "Soufre", "Sulfur", 32.06, "nonMetal"],
  ["Cl", "Chlore", "Chlorine", 35.45, "halogen"],
  ["Ar", "Argon", "Argon", 39.948, "nobleGas"],
  ["K", "Potassium", "Potassium", 39.098, "alkali"],
  ["Ca", "Calcium", "Calcium", 40.078, "alkalineEarth"],
  ["Sc", "Scandium", "Scandium", 44.956, "transition"],
  ["Ti", "Titane", "Titanium", 47.867, "transition"],
  ["V", "Vanadium", "Vanadium", 50.942, "transition"],
  ["Cr", "Chrome", "Chromium", 51.996, "transition"],
  ["Mn", "Manganèse", "Manganese", 54.938, "transition"],
  ["Fe", "Fer", "Iron", 55.845, "transition"],
  ["Co", "Cobalt", "Cobalt", 58.933, "transition"],
  ["Ni", "Nickel", "Nickel", 58.693, "transition"],
  ["Cu", "Cuivre", "Copper", 63.546, "transition"],
  ["Zn", "Zinc", "Zinc", 65.38, "transition"],
  ["Ga", "Gallium", "Gallium", 69.723, "postTransition"],
  ["Ge", "Germanium", "Germanium", 72.630, "metalloid"],
  ["As", "Arsenic", "Arsenic", 74.922, "metalloid"],
  ["Se", "Sélénium", "Selenium", 78.971, "nonMetal"],
  ["Br", "Brome", "Bromine", 79.904, "halogen"],
  ["Kr", "Krypton", "Krypton", 83.798, "nobleGas"],
  ["Rb", "Rubidium", "Rubidium", 85.468, "alkali"],
  ["Sr", "Strontium", "Strontium", 87.62, "alkalineEarth"],
  ["Y", "Yttrium", "Yttrium", 88.906, "transition"],
  ["Zr", "Zirconium", "Zirconium", 91.224, "transition"],
  ["Nb", "Niobium", "Niobium", 92.906, "transition"],
  ["Mo", "Molybdène", "Molybdenum", 95.95, "transition"],
  ["Tc", "Technétium", "Technetium", 98, "transition"],
  ["Ru", "Ruthénium", "Ruthenium", 101.07, "transition"],
  ["Rh", "Rhodium", "Rhodium", 102.91, "transition"],
  ["Pd", "Palladium", "Palladium", 106.42, "transition"],
  ["Ag", "Argent", "Silver", 107.87, "transition"],
  ["Cd", "Cadmium", "Cadmium", 112.41, "transition"],
  ["In", "Indium", "Indium", 114.82, "postTransition"],
  ["Sn", "Étain", "Tin", 118.71, "postTransition"],
  ["Sb", "Antimoine", "Antimony", 121.76, "metalloid"],
  ["Te", "Tellure", "Tellurium", 127.60, "metalloid"],
  ["I", "Iode", "Iodine", 126.90, "halogen"],
  ["Xe", "Xénon", "Xenon", 131.29, "nobleGas"],
  ["Cs", "Césium", "Caesium", 132.91, "alkali"],
  ["Ba", "Baryum", "Barium", 137.33, "alkalineEarth"],
  ["La", "Lanthane", "Lanthanum", 138.91, "lanthanide"],
  ["Ce", "Cérium", "Cerium", 140.12, "lanthanide"],
  ["Pr", "Praséodyme", "Praseodymium", 140.91, "lanthanide"],
  ["Nd", "Néodyme", "Neodymium", 144.24, "lanthanide"],
  ["Pm", "Prométhium", "Promethium", 145, "lanthanide"],
  ["Sm", "Samarium", "Samarium", 150.36, "lanthanide"],
  ["Eu", "Europium", "Europium", 151.96, "lanthanide"],
  ["Gd", "Gadolinium", "Gadolinium", 157.25, "lanthanide"],
  ["Tb", "Terbium", "Terbium", 158.93, "lanthanide"],
  ["Dy", "Dysprosium", "Dysprosium", 162.50, "lanthanide"],
  ["Ho", "Holmium", "Holmium", 164.93, "lanthanide"],
  ["Er", "Erbium", "Erbium", 167.26, "lanthanide"],
  ["Tm", "Thulium", "Thulium", 168.93, "lanthanide"],
  ["Yb", "Ytterbium", "Ytterbium", 173.05, "lanthanide"],
  ["Lu", "Lutécium", "Lutetium", 174.97, "lanthanide"],
  ["Hf", "Hafnium", "Hafnium", 178.49, "transition"],
  ["Ta", "Tantale", "Tantalum", 180.95, "transition"],
  ["W", "Tungstène", "Tungsten", 183.84, "transition"],
  ["Re", "Rhénium", "Rhenium", 186.21, "transition"],
  ["Os", "Osmium", "Osmium", 190.23, "transition"],
  ["Ir", "Iridium", "Iridium", 192.22, "transition"],
  ["Pt", "Platine", "Platinum", 195.08, "transition"],
  ["Au", "Or", "Gold", 196.97, "transition"],
  ["Hg", "Mercure", "Mercury", 200.59, "transition"],
  ["Tl", "Thallium", "Thallium", 204.38, "postTransition"],
  ["Pb", "Plomb", "Lead", 207.2, "postTransition"],
  ["Bi", "Bismuth", "Bismuth", 208.98, "postTransition"],
  ["Po", "Polonium", "Polonium", 209, "postTransition"],
  ["At", "Astate", "Astatine", 210, "halogen"],
  ["Rn", "Radon", "Radon", 222, "nobleGas"],
  ["Fr", "Francium", "Francium", 223, "alkali"],
  ["Ra", "Radium", "Radium", 226, "alkalineEarth"],
  ["Ac", "Actinium", "Actinium", 227, "actinide"],
  ["Th", "Thorium", "Thorium", 232.04, "actinide"],
  ["Pa", "Protactinium", "Protactinium", 231.04, "actinide"],
  ["U", "Uranium", "Uranium", 238.03, "actinide"],
  ["Np", "Neptunium", "Neptunium", 237, "actinide"],
  ["Pu", "Plutonium", "Plutonium", 244, "actinide"],
  ["Am", "Américium", "Americium", 243, "actinide"],
  ["Cm", "Curium", "Curium", 247, "actinide"],
  ["Bk", "Berkélium", "Berkelium", 247, "actinide"],
  ["Cf", "Californium", "Californium", 251, "actinide"],
  ["Es", "Einsteinium", "Einsteinium", 252, "actinide"],
  ["Fm", "Fermium", "Fermium", 257, "actinide"],
  ["Md", "Mendélévium", "Mendelevium", 258, "actinide"],
  ["No", "Nobélium", "Nobelium", 259, "actinide"],
  ["Lr", "Lawrencium", "Lawrencium", 266, "actinide"],
  ["Rf", "Rutherfordium", "Rutherfordium", 267, "transition"],
  ["Db", "Dubnium", "Dubnium", 268, "transition"],
  ["Sg", "Seaborgium", "Seaborgium", 269, "transition"],
  ["Bh", "Bohrium", "Bohrium", 270, "transition"],
  ["Hs", "Hassium", "Hassium", 269, "transition"],
  ["Mt", "Meitnérium", "Meitnerium", 278, "transition"],
  ["Ds", "Darmstadtium", "Darmstadtium", 281, "transition"],
  ["Rg", "Roentgenium", "Roentgenium", 282, "transition"],
  ["Cn", "Copernicium", "Copernicium", 285, "transition"],
  ["Nh", "Nihonium", "Nihonium", 286, "postTransition"],
  ["Fl", "Flérovium", "Flerovium", 289, "postTransition"],
  ["Mc", "Moscovium", "Moscovium", 290, "postTransition"],
  ["Lv", "Livermorium", "Livermorium", 293, "postTransition"],
  ["Ts", "Tennesse", "Tennessine", 294, "halogen"],
  ["Og", "Oganesson", "Oganesson", 294, "nobleGas"],
];

export const ELEMENTS: readonly Element[] = DATA.map(([symbol, fr, en, mass, category], i) => ({
  z: i + 1,
  symbol,
  name: { fr, en },
  mass,
  category,
}));

const PERIOD_STARTS = [1, 3, 11, 19, 37, 55, 87, 119];

/**
 * Case d'un élément : lignes 1 à 7 pour les périodes, 9 et 10 pour les
 * lanthanides et actinides (colonnes 3 à 17), colonnes 1 à 18.
 */
export function elementPosition(z: number): { row: number; column: number } {
  const period = PERIOD_STARTS.findIndex((start, i) => z >= start && z < PERIOD_STARTS[i + 1]) + 1;
  const offset = z - PERIOD_STARTS[period - 1];
  if (period === 1) return { row: 1, column: z === 1 ? 1 : 18 };
  if (period <= 3) return { row: period, column: offset < 2 ? offset + 1 : offset + 11 };
  if (period <= 5) return { row: period, column: offset + 1 };
  // Périodes 6 et 7 : deux premières colonnes, puis la série f à part, puis les colonnes 4 à 18.
  if (offset < 2) return { row: period, column: offset + 1 };
  if (offset < 17) return { row: period + 3, column: offset + 1 };
  return { row: period, column: offset - 13 };
}
