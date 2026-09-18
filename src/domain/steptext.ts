// Recipe steps that follow the rest of the app: amounts scale with the serving size (or a
// scale-to-one-ingredient choice), measures switch between US and metric, oven temperatures
// convert, and swapped ingredients are renamed. Pure string work — no DB, no React.
import { displayStep } from './substitute';
import type { Ingredient, Recipe, UnitSystem } from './types';
import { formatNumber, normalizeUnit, pluralize, singularize, UNITS } from './units';

export interface StepOptions {
  /** Servings scale: 0.5 halves every amount written in the text. */
  scale?: number;
  system?: UnitSystem;
  recipe?: Recipe;
  ingById?: Map<string, Ingredient>;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const VULGAR: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

/** Things a recipe counts rather than measures: "3 cans", "2 cloves", "4 thighs". */
const COUNTABLE = new Set([
  'can', 'jar', 'package', 'packet', 'box', 'bag', 'container', 'carton', 'tin', 'bottle', 'block', 'bar',
  'clove', 'head', 'bunch', 'sprig', 'stalk', 'rib', 'ear', 'link', 'slice', 'strip', 'sheet', 'wedge',
  'piece', 'fillet', 'breast', 'thigh', 'drumstick', 'chop', 'cutlet', 'patty', 'tortilla', 'egg', 'handful',
]);

/** Words that mean the number in front of them is a time or a size, not an amount of food. */
const NOT_AN_AMOUNT = new Set([
  'minute', 'min', 'mins', 'hour', 'hr', 'second', 'sec', 'day', 'week', 'month', 'inch', 'in', 'cm', 'mm',
  'degree', 'percent', 'time', 'batch', 'serving', 'person', 'people', 'side', 'half', 'third', 'quarter',
  'layer', 'row', 'step', 'more', 'additional', 'further', 'other', 'large', 'medium', 'small',
]);

/** A measure right before one of these describes the equipment, e.g. "a 2-quart baking dish". */
const VESSEL = /^\s*-?\s*(dish|pan|pot|skillet|casserole|bowl|baking|oven|saucepan|dutch|container|ramekin|tin|mold|loaf|tray|cooker|blender|processor|glass|jug|measure)\b/i;

const LONG: Record<string, string> = {
  tsp: 'teaspoon', tbsp: 'tablespoon', cup: 'cup', 'fl oz': 'fluid ounce', oz: 'ounce', lb: 'pound',
  g: 'gram', kg: 'kilogram', ml: 'milliliter', l: 'liter', pint: 'pint', quart: 'quart', gallon: 'gallon',
  pinch: 'pinch', dash: 'dash',
};

const METRIC = new Set(['g', 'kg', 'ml', 'l']);
const US = new Set(['oz', 'lb', 'tsp', 'tbsp', 'fl oz', 'cup', 'pint', 'quart', 'gallon']);

function parseNumber(raw: string): number | undefined {
  const s = raw.trim().toLowerCase();
  if (s in WORD_NUMBERS) return WORD_NUMBERS[s];
  if (s in VULGAR) return VULGAR[s];
  const mixed = s.match(/^(\d+)\s*([½⅓⅔¼¾⅛⅜⅝⅞])$/);
  if (mixed) return Number(mixed[1]) + VULGAR[mixed[2]];
  const frac = s.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  if (frac) return (frac[1] ? Number(frac[1]) : 0) + Number(frac[2]) / Number(frac[3]);
  const n = Number(s);
  return isFinite(n) ? n : undefined;
}

/** Round metric amounts to numbers a cook would actually measure out. */
function tidyMetric(n: number): number {
  if (n >= 400) return Math.round(n / 50) * 50;
  if (n >= 100) return Math.round(n / 10) * 10;
  if (n >= 20) return Math.round(n / 5) * 5;
  return Math.round(n);
}

/** Put a measure into the reader's system when it was written in the other one. */
function convert(qty: number, unit: string, system: UnitSystem): { qty: number; unit: string } {
  const def = UNITS[unit];
  if (!def) return { qty, unit };
  if (system === 'metric' && US.has(unit)) {
    if (unit === 'tsp' || unit === 'tbsp') return { qty, unit }; // metric kitchens use these too
    const amt = qty * def.factor;
    if (def.dim === 'mass') {
      return amt >= 1000 ? { qty: Math.round(amt / 100) / 10, unit: 'kg' } : { qty: tidyMetric(amt), unit: 'g' };
    }
    return amt >= 1000 ? { qty: Math.round(amt / 100) / 10, unit: 'l' } : { qty: tidyMetric(amt), unit: 'ml' };
  }
  if (system === 'us' && METRIC.has(unit)) {
    const amt = qty * def.factor;
    if (def.dim === 'mass') {
      return amt >= 454 ? { qty: amt / UNITS.lb.factor, unit: 'lb' } : { qty: amt / UNITS.oz.factor, unit: 'oz' };
    }
    if (amt < 15) return { qty: amt / UNITS.tsp.factor, unit: 'tsp' };
    if (amt < 60) return { qty: amt / UNITS.tbsp.factor, unit: 'tbsp' };
    return { qty: amt / UNITS.cup.factor, unit: 'cup' };
  }
  return { qty, unit };
}

function writeAmount(qty: number, unit: string, spellOut: boolean): string {
  const metric = METRIC.has(unit);
  const num = metric ? String(Math.round(qty * 10) / 10) : formatNumber(qty);
  const many = qty > 1 + 1e-9;
  if (spellOut && LONG[unit]) return `${num} ${many ? pluralize(LONG[unit]) : LONG[unit]}`;
  if (metric) return `${num} ${unit === 'l' ? 'L' : unit}`;
  const def = UNITS[unit];
  return `${num} ${def ? (many ? def.plural : def.singular) : unit}`;
}

/** Words this recipe counts ("2 onions", "4 tortillas"), so those numbers scale as well. */
export function countableWords(recipe?: Recipe, ingById?: Map<string, Ingredient>): Set<string> {
  const out = new Set<string>();
  if (!recipe || !ingById) return out;
  for (const ri of recipe.ingredients) {
    const ing = ingById.get(ri.ingredientId);
    if (!ing) continue;
    for (const name of [ing.name, ...(ing.aliases ?? [])]) {
      const words = name.toLowerCase().split(/\s+/);
      const last = singularize(words[words.length - 1]);
      if (last.length > 2) out.add(last);
    }
  }
  return out;
}

const NUM = String.raw`\d+\s+\d+\s*/\s*\d+|\d+\s*/\s*\d+|\d+(?:\.\d+)?\s*[½⅓⅔¼¾⅛⅜⅝⅞]|\d+(?:\.\d+)?|[½⅓⅔¼¾⅛⅜⅝⅞]`;
const AMOUNT = new RegExp(
  String.raw`(?<![\d.\-–/x×])(` + NUM + String.raw`|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b)` +
    String.raw`(\s*\([^)]*\))?(\s*-\s*|\s+)([A-Za-z][A-Za-z.]*)(\s+(?:ounces?|oz)\b)?`,
  'gi',
);

/** Scale every amount written in a step, and put each measure in the reader's system. */
export function scaleStepText(text: string, scale: number, system: UnitSystem, words: Set<string>): string {
  return text.replace(AMOUNT, (...args: unknown[]) => {
    const whole = args[0] as string;
    const rawNum = args[1] as string;
    const paren = args[2] as string | undefined;
    const gap = args[3] as string;
    const rawWord = args[4] as string;
    const tail = args[5] as string | undefined;
    const offset = args[6] as number;
    const full = args[7] as string;

    const qty = parseNumber(rawNum);
    if (qty === undefined || qty <= 0) return whole;
    const dot = rawWord.endsWith('.') ? '.' : '';
    const bare = rawWord.replace(/\.$/, '').toLowerCase();
    const word = tail && (bare === 'fl' || bare === 'fluid') ? 'fl oz' : bare;
    const singular = singularize(word);
    if (NOT_AN_AMOUNT.has(singular)) return whole;
    const unit = normalizeUnit(word);
    const isUnit = unit in UNITS && unit !== 'ea';
    const isCount = COUNTABLE.has(singular) || words.has(singular);
    if (!isUnit && !isCount) return whole;
    // "a 2-quart baking dish", "a 9-inch pan": the number sizes equipment, it is not an amount.
    if (VESSEL.test(full.slice(offset + whole.length))) return whole;

    if (isUnit) {
      const spellOut = rawWord.length > 5 || bare.startsWith('cup');
      const c = convert(qty * scale, unit, system);
      const converted = c.unit !== unit;
      const out = writeAmount(c.qty, c.unit, converted ? false : spellOut);
      // A parenthetical like "(15 oz)" describes the package, so it stays as written.
      return (converted ? out : `${out}${paren ?? ''}`) + dot;
    }
    const scaled = qty * scale;
    const noun = scaled > 1 + 1e-9 ? pluralize(singular) : singular;
    const cased = /^[A-Z]/.test(rawWord) ? noun[0].toUpperCase() + noun.slice(1) : noun;
    return `${formatNumber(scaled)}${paren ?? ''}${gap}${cased}${dot}`;
  });
}

const TEMP = /(\d{2,3})\s*[°º]?\s*(?:degrees?\s*)?(F|C|Fahrenheit|Celsius)\b(?:\s*\(\s*\d{2,3}\s*[°º]?\s*(?:degrees?\s*)?(?:F|C|Fahrenheit|Celsius)\s*\))?/gi;

const toC = (f: number) => Math.round((f - 32) * 5 / 9 / 5) * 5;
const toF = (c: number) => Math.round((c * 9 / 5 + 32) / 5) * 5;

/** Oven temperatures in the reader's system, with any duplicate in the other system dropped. */
export function convertTemps(text: string, system: UnitSystem): string {
  return text.replace(TEMP, (_whole: string, num: string, letter: string) => {
    const n = Number(num);
    const isF = letter[0].toUpperCase() === 'F';
    const want: 'F' | 'C' = system === 'metric' ? 'C' : 'F';
    const value = isF === (want === 'F') ? n : want === 'C' ? toC(n) : toF(n);
    return `${value}°${want}`;
  });
}

/** One step, ready to read: swapped names, scaled amounts, the reader's units and temperatures. */
export function renderStep(text: string, o: StepOptions = {}): string {
  const { scale = 1, system = 'us', recipe, ingById } = o;
  let out = text;
  if (recipe && ingById) out = displayStep(out, recipe, ingById);
  if (scale !== 1 || system !== 'us') out = scaleStepText(out, scale, system, countableWords(recipe, ingById));
  return convertTemps(out, system);
}
