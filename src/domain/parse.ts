// Text parsing: "2 ½ cups flour, sifted" → structured ingredient lines, and whole pasted recipes.
import Fuse from 'fuse.js';
import { UNITS, normalizeUnit, singularize } from './units';
import type { Ingredient } from './types';

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8,
  '⅞': 7 / 8, '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5, '⅙': 1 / 6, '⅚': 5 / 6,
};
const UF = Object.keys(UNICODE_FRACTIONS).join('');
const NUM = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\.\\d+|\\d+\\s*[${UF}]|\\d+|[${UF}])`;
const QTY_RE = new RegExp(`^\\s*(${NUM})(?:\\s*(?:-|–|to)\\s*(${NUM}))?`);

/** Parse "1 1/2", "1½", ".5", "3/4" → number. */
export function parseNumber(token: string): number | undefined {
  const t = token.trim();
  if (!t) return undefined;
  let m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  m = t.match(new RegExp(`^(\\d+)?\\s*([${UF}])$`));
  if (m) return Number(m[1] ?? 0) + UNICODE_FRACTIONS[m[2]];
  const n = Number(t);
  return isFinite(n) ? n : undefined;
}

export function parseQuantity(s: string): { qty: number; rest: string } | null {
  const m = s.match(QTY_RE);
  if (!m) return null;
  const a = parseNumber(m[1]);
  const b = m[2] ? parseNumber(m[2]) : undefined;
  if (a === undefined) return null;
  return { qty: b ?? a, rest: s.slice(m[0].length).trim() };
}

/** Ingredient-specific units the parser recognizes (not in the global table). */
export const COUNT_UNITS = new Set([
  'clove', 'can', 'stalk', 'rib', 'bunch', 'head', 'slice', 'sprig', 'jar', 'package', 'packet', 'stick',
  'crown', 'leaf', 'container', 'bag', 'box', 'knob', 'inch', 'heart', 'bottle', 'handful',
]);

const SIZE_WORDS = /^(large|medium|small|big|extra[- ]large|heaping|scant|generous)\s+/i;

export interface ParsedLine {
  raw: string;
  qty: number;
  unit: string;
  name: string;
  prep?: string;
  optional: boolean;
  ingredientId?: string;
}

export type IngredientMatcher = (name: string) => string | undefined;

function clean(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9%/ -]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function createIngredientMatcher(ingredients: Ingredient[]): IngredientMatcher {
  const exact = new Map<string, string>();
  for (const ing of ingredients) {
    for (const n of [ing.name, ...ing.aliases]) {
      const c = clean(n);
      exact.set(c, ing.id);
      exact.set(singularize(c), ing.id);
    }
  }
  const fuse = new Fuse(
    ingredients.map((i) => ({ id: i.id, name: i.name, aliases: i.aliases })),
    { keys: [{ name: 'name', weight: 2 }, 'aliases'], threshold: 0.34, ignoreLocation: true, includeScore: true },
  );
  return (name: string) => {
    const c = clean(name).replace(/^(fresh|freshly|chopped|minced|diced|sliced|grated|shredded|dried|whole)\s+/, '');
    if (!c) return undefined;
    const hit = exact.get(c) ?? exact.get(singularize(c));
    if (hit) return hit;
    // try dropping leading words: "boneless skinless chicken thighs" → "chicken thighs"
    const words = c.split(' ');
    for (let i = 1; i < words.length; i++) {
      const tail = words.slice(i).join(' ');
      const h = exact.get(tail) ?? exact.get(singularize(tail));
      if (h) return h;
    }
    return fuse.search(c)[0]?.item.id;
  };
}

export function parseIngredientLine(line: string, match?: IngredientMatcher): ParsedLine {
  const raw = line.trim();
  let s = raw.replace(/^[-•*▢□●◦·‣]+\s*/, '');
  const optional = /\(optional\)|\boptional\b|\bfor serving\b|\bfor garnish\b/i.test(s);
  s = s.replace(/\(optional\)/gi, '').replace(/,?\s*optional\b/gi, '');

  let qty = 0;
  const q = parseQuantity(s);
  if (q) {
    qty = q.qty;
    s = q.rest;
  } else if (/^(a|an|one)\s+/i.test(s)) {
    qty = 1;
    s = s.replace(/^(a|an|one)\s+/i, '');
  }

  const notes: string[] = [];
  s = s.replace(/^\(([^)]*)\)\s*/, (_, inner: string) => {
    notes.push(inner);
    return '';
  });

  let unit = '';
  const tokens = s.split(/\s+/);
  const two = tokens.slice(0, 2).join(' ').toLowerCase().replace(/[.,]/g, '');
  const one = (tokens[0] ?? '').replace(/[.,]$/, '');
  if (normalizeUnit(two) in UNITS && two.includes(' ')) {
    unit = normalizeUnit(two);
    s = tokens.slice(2).join(' ');
  } else if (one && normalizeUnit(one) in UNITS && normalizeUnit(one) !== 'ea') {
    unit = normalizeUnit(one);
    s = tokens.slice(1).join(' ');
  } else if (one && COUNT_UNITS.has(singularize(one.toLowerCase()))) {
    unit = singularize(one.toLowerCase());
    s = tokens.slice(1).join(' ');
  }

  s = s.replace(/^of\s+/i, '');
  const size = s.match(SIZE_WORDS);
  if (size) {
    notes.unshift(size[1].toLowerCase());
    s = s.slice(size[0].length);
  }
  let name = s;
  const comma = s.indexOf(',');
  if (comma >= 0) {
    name = s.slice(0, comma);
    notes.push(s.slice(comma + 1).trim());
  }
  name = name.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    notes.push(inner);
    return '';
  });
  name = name.replace(/\bto taste\b/i, '').replace(/\s+/g, ' ').trim();
  const prep = notes.map((n) => n.trim()).filter(Boolean).join(', ') || undefined;

  return {
    raw, qty, unit: unit || 'ea', name, prep, optional,
    ingredientId: match ? match(name) : undefined,
  };
}

export interface ParsedRecipe {
  title: string;
  description: string;
  servings?: number;
  prepMin?: number;
  cookMin?: number;
  ingredients: ParsedLine[];
  steps: string[];
}

function minutesFrom(text: string, label: RegExp): number | undefined {
  const m = text.match(new RegExp(`${label.source}[^\\d\\n]{0,20}(\\d+)\\s*(h|hr|hrs|hour|hours|m|min|mins|minutes)\\b(?:\\s*(\\d+)\\s*(?:m|min|mins|minutes))?`, 'i'));
  if (!m) return undefined;
  const n = Number(m[1]);
  const isHours = /^h/i.test(m[2]);
  return isHours ? n * 60 + Number(m[3] ?? 0) : n;
}

export function parseRecipeText(text: string, match?: IngredientMatcher): ParsedRecipe {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const ING_HEADER = /^(ingredients?)\s*:?$/i;
  const STEP_HEADER = /^(instructions|directions|method|steps|preparation|how to make( it)?)\s*:?$/i;
  const META = /\b(serves|servings|yield|makes|prep|cook|total)\b.*\d/i;

  const hasHeaders = lines.some((l) => ING_HEADER.test(l)) || lines.some((l) => STEP_HEADER.test(l));
  let mode: 'head' | 'ing' | 'steps' = 'head';
  let title = '';
  const desc: string[] = [];
  const ingLines: string[] = [];
  const steps: string[] = [];

  for (const l of lines) {
    if (!l) continue;
    if (ING_HEADER.test(l)) { mode = 'ing'; continue; }
    if (STEP_HEADER.test(l)) { mode = 'steps'; continue; }
    if (!hasHeaders && title) {
      mode = parseQuantity(l) || /^[-•*]/.test(l) ? 'ing' : l.length > 50 ? 'steps' : mode;
    }
    if (mode === 'head') {
      if (!title && !META.test(l)) title = l;
      else if (!META.test(l)) desc.push(l);
    } else if (mode === 'ing') {
      if (/:$/.test(l)) continue; // sub-header like "For the sauce:"
      ingLines.push(l);
    } else {
      const step = l.replace(/^(step\s*)?\d+[.):]?\s+/i, '').trim();
      if (step) steps.push(step);
    }
  }

  const servingsMatch = text.match(/\b(?:serves|servings|yield|makes)\b\s*:?\s*(\d+)/i);
  return {
    title,
    description: desc.join(' '),
    servings: servingsMatch ? Number(servingsMatch[1]) : undefined,
    prepMin: minutesFrom(text, /prep(?:aration)?(?:\s*time)?/),
    cookMin: minutesFrom(text, /cook(?:ing)?(?:\s*time)?/),
    ingredients: ingLines.map((l) => parseIngredientLine(l, match)),
    steps,
  };
}

/** Find a timer in a step ("simmer 20 minutes" → 1200 s). Uses the upper bound of ranges. */
export function detectTimerSec(step: string): number | undefined {
  const m = step.match(/(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s*(hours?|hrs?|minutes?|mins?)\b/i);
  if (!m) return undefined;
  const n = Number(m[2] ?? m[1]);
  return /^h/i.test(m[3]) ? n * 3600 : n * 60;
}
