// Units engine: converts any recipe/pantry quantity into an ingredient's base unit,
// and formats base quantities back into friendly kitchen units.
import type { BaseUnit, Dimension, Ingredient, UnitSystem } from './types';

export class ConversionError extends Error {}

interface UnitDef {
  dim: Dimension;
  factor: number; // to g / ml / ea
  singular: string;
  plural: string;
}

export const UNITS: Record<string, UnitDef> = {
  g: { dim: 'mass', factor: 1, singular: 'g', plural: 'g' },
  kg: { dim: 'mass', factor: 1000, singular: 'kg', plural: 'kg' },
  oz: { dim: 'mass', factor: 28.3495, singular: 'oz', plural: 'oz' },
  lb: { dim: 'mass', factor: 453.592, singular: 'lb', plural: 'lb' },
  ml: { dim: 'volume', factor: 1, singular: 'ml', plural: 'ml' },
  l: { dim: 'volume', factor: 1000, singular: 'L', plural: 'L' },
  pinch: { dim: 'volume', factor: 0.31, singular: 'pinch', plural: 'pinches' },
  dash: { dim: 'volume', factor: 0.62, singular: 'dash', plural: 'dashes' },
  tsp: { dim: 'volume', factor: 4.92892, singular: 'tsp', plural: 'tsp' },
  tbsp: { dim: 'volume', factor: 14.7868, singular: 'tbsp', plural: 'tbsp' },
  'fl oz': { dim: 'volume', factor: 29.5735, singular: 'fl oz', plural: 'fl oz' },
  cup: { dim: 'volume', factor: 236.588, singular: 'cup', plural: 'cups' },
  pint: { dim: 'volume', factor: 473.176, singular: 'pint', plural: 'pints' },
  quart: { dim: 'volume', factor: 946.353, singular: 'quart', plural: 'quarts' },
  gallon: { dim: 'volume', factor: 3785.41, singular: 'gallon', plural: 'gallons' },
  ea: { dim: 'count', factor: 1, singular: '', plural: '' },
  dozen: { dim: 'count', factor: 12, singular: 'dozen', plural: 'dozen' },
};

/** Units offered in pickers, in a sensible order. */
export const COMMON_UNITS = ['ea', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'g', 'kg', 'ml', 'l', 'fl oz', 'pinch'];

const SYNONYMS: Record<string, string> = {
  gram: 'g', grams: 'g', gr: 'g', gm: 'g', gms: 'g',
  kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg', kgs: 'kg',
  ounce: 'oz', ounces: 'oz', ozs: 'oz',
  pound: 'lb', pounds: 'lb', lbs: 'lb',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', mls: 'ml',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  teaspoon: 'tsp', teaspoons: 'tsp', tsps: 'tsp', ts: 'tsp',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tbl: 'tbsp', tblsp: 'tbsp', tbls: 'tbsp',
  cups: 'cup', c: 'cup',
  floz: 'fl oz', 'fl. oz': 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
  pints: 'pint', pt: 'pint', pts: 'pint',
  quarts: 'quart', qt: 'quart', qts: 'quart',
  gallons: 'gallon', gal: 'gallon', gals: 'gallon',
  pinches: 'pinch', dashes: 'dash',
  each: 'ea', whole: 'ea', piece: 'ea', pieces: 'ea', pc: 'ea', pcs: 'ea', x: 'ea', '': 'ea',
};

export function normalizeUnit(raw: string): string {
  const trimmed = (raw ?? '').trim().replace(/\.$/, '');
  if (trimmed === 'T' || trimmed === 'Tb') return 'tbsp';
  if (trimmed === 't') return 'tsp';
  const lower = trimmed.toLowerCase().replace(/\s+/g, ' ');
  if (lower in UNITS) return lower;
  if (lower in SYNONYMS) return SYNONYMS[lower];
  return lower; // possibly an ingredient-specific alias like 'clove'
}

export function isGlobalUnit(unit: string): boolean {
  return normalizeUnit(unit) in UNITS;
}

export function singularize(word: string): string {
  if (word === 'leaves') return 'leaf';
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (/(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function pluralize(word: string): string {
  if (!word) return word;
  if (word === 'leaf') return 'leaves';
  if (/(ch|sh|ss|x)$/.test(word)) return word + 'es';
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies';
  if (word.endsWith('s')) return word;
  return word + 's';
}

export const dimOf = (b: BaseUnit): Dimension => (b === 'g' ? 'mass' : b === 'ml' ? 'volume' : 'count');

function aliasFor(ing: Ingredient, unit: string): number | undefined {
  const a = ing.unitAliases;
  if (!a) return undefined;
  if (unit in a) return a[unit];
  const s = singularize(unit);
  if (s in a) return a[s];
  return undefined;
}

function toGrams(amt: number, dim: Dimension, ing: Ingredient): number | undefined {
  if (dim === 'mass') return amt;
  if (dim === 'volume') return ing.density ? amt * ing.density : undefined;
  return ing.gramsPerEach ? amt * ing.gramsPerEach : undefined;
}

function fromGrams(g: number, dim: Dimension, ing: Ingredient): number | undefined {
  if (dim === 'mass') return g;
  if (dim === 'volume') return ing.density ? g / ing.density : undefined;
  return ing.gramsPerEach ? g / ing.gramsPerEach : undefined;
}

/** Convert qty of `unit` into `ing.baseUnit`. Throws ConversionError if impossible. */
export function toBase(qty: number, unit: string, ing: Ingredient): number {
  const u = normalizeUnit(unit);
  const alias = aliasFor(ing, u);
  if (alias !== undefined) return qty * alias;
  const def = UNITS[u];
  if (!def) throw new ConversionError(`Unknown unit "${unit}" for ${ing.name}`);
  const amt = qty * def.factor;
  const to = dimOf(ing.baseUnit);
  if (def.dim === to) return amt;
  const grams = toGrams(amt, def.dim, ing);
  const out = grams === undefined ? undefined : fromGrams(grams, to, ing);
  if (out === undefined) {
    throw new ConversionError(`Can't convert "${unit}" to ${ing.baseUnit} for ${ing.name}`);
  }
  return out;
}

export function canConvert(unit: string, ing: Ingredient): boolean {
  try {
    toBase(1, unit, ing);
    return true;
  } catch {
    return false;
  }
}

/** Convert a base quantity into a given unit. */
export function fromBase(base: number, unit: string, ing: Ingredient): number {
  return base / toBase(1, unit, ing);
}

/** Units that make sense for an ingredient (aliases first). */
export function unitsFor(ing: Ingredient): string[] {
  const aliases = Object.keys(ing.unitAliases ?? {});
  const globals = COMMON_UNITS.filter((u) => canConvert(u, ing) && !aliases.includes(u));
  return [...aliases, ...globals];
}

// ---------- formatting ----------

const FRACTIONS: [number, string][] = [
  [0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'],
  [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'], [1, ''],
];

/** 1.5 → "1½", 0.333 → "⅓", 12.2 → "12". */
export function formatNumber(n: number): string {
  if (!isFinite(n) || n <= 0) return '0';
  if (n >= 20) return String(Math.round(n));
  if (n >= 10) {
    const r = Math.round(n * 2) / 2;
    return Number.isInteger(r) ? String(r) : `${Math.floor(r)}½`;
  }
  let whole = Math.floor(n);
  const frac = n - whole;
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(frac - f[0]) < Math.abs(frac - best[0])) best = f;
  if (best[0] === 1) {
    whole += 1;
    best = FRACTIONS[0];
  }
  if (whole === 0 && !best[1]) return '⅛';
  return whole === 0 ? best[1] : `${whole}${best[1]}`;
}

function formatDecimal(n: number): string {
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
}

export function unitLabel(unit: string, qty: number): string {
  const u = normalizeUnit(unit);
  const def = UNITS[u];
  const many = qty > 1 + 1e-9;
  if (def) return many ? def.plural : def.singular;
  return many ? pluralize(u) : u;
}

const METRIC_UNITS = new Set(['g', 'kg', 'ml', 'l']);

/** Format a quantity already expressed in `unit` (used for recipe display). */
export function formatAmount(qty: number, unit: string): string {
  const u = normalizeUnit(unit);
  const num = METRIC_UNITS.has(u) ? formatDecimal(qty) : formatNumber(qty);
  const label = unitLabel(u, qty);
  return label ? `${num} ${label}` : num;
}

/** Choose a friendly unit for a base quantity. */
export function displayQty(base: number, ing: Ingredient, system: UnitSystem = 'us'): { qty: number; unit: string } {
  if (ing.displayUnit && ing.unitAliases?.[ing.displayUnit]) {
    return { qty: base / ing.unitAliases[ing.displayUnit], unit: ing.displayUnit };
  }
  switch (ing.baseUnit) {
    case 'ea':
      return { qty: base, unit: 'ea' };
    case 'g': {
      if (system === 'metric') return base >= 1000 ? { qty: base / 1000, unit: 'kg' } : { qty: base, unit: 'g' };
      if (base < 25 && ing.density) return volumeUS(base / ing.density);
      const oz = base / UNITS.oz.factor;
      return oz < 16 ? { qty: oz, unit: 'oz' } : { qty: base / UNITS.lb.factor, unit: 'lb' };
    }
    case 'ml':
      if (system === 'metric') return base >= 1000 ? { qty: base / 1000, unit: 'l' } : { qty: base, unit: 'ml' };
      return volumeUS(base);
  }
}

function volumeUS(ml: number): { qty: number; unit: string } {
  if (ml < 14) return { qty: ml / UNITS.tsp.factor, unit: 'tsp' };
  if (ml < 59) return { qty: ml / UNITS.tbsp.factor, unit: 'tbsp' };
  if (ml < 1890) return { qty: ml / UNITS.cup.factor, unit: 'cup' };
  return { qty: ml / UNITS.gallon.factor, unit: 'gallon' };
}

/** Format a base quantity for an ingredient, e.g. "1½ lb", "3 cloves", "2". */
export function formatQty(base: number, ing: Ingredient, system: UnitSystem = 'us'): string {
  const { qty, unit } = displayQty(base, ing, system);
  return formatAmount(qty, unit);
}
