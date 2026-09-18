// Scale a recipe to what you actually have: "I want to use one can of beans" or "1 lb of ground
// turkey", and every other amount (and the serving count) follows. Pure math — no DB, no React.
import type { Ingredient, Recipe, RecipeIngredient } from './types';
import { canConvert, formatAmount, toBase, unitLabel, unitsFor } from './units';

export interface ScaleChoice {
  qty: number;
  unit: string;
  /** "1 can", "1 lb" — what the button says. */
  label: string;
  factor: number;
  servings: number;
}

/** How much the whole recipe has to grow or shrink to use exactly `qty` `unit` of this ingredient. */
export function scaleToAmount(ri: RecipeIngredient, ing: Ingredient, qty: number, unit: string): number | undefined {
  if (qty <= 0 || ri.qty <= 0) return undefined;
  try {
    const want = toBase(qty, unit, ing);
    const called = toBase(ri.qty, ri.unit, ing);
    if (!isFinite(want) || !isFinite(called) || called <= 0) return undefined;
    return want / called;
  } catch {
    return undefined;
  }
}

/** Servings for a scale factor, kept to halves so the number stays readable. */
export function servingsAtScale(recipe: Recipe, factor: number): number {
  const s = (recipe.baseServings || 1) * factor;
  return Math.max(0.5, Math.round(s * 2) / 2);
}

/** Round amounts a shopper would actually buy, near what the recipe calls for. */
function candidates(called: number, unit: string, ing: Ingredient): { qty: number; unit: string }[] {
  const out: { qty: number; unit: string }[] = [];
  const whole = [0.5, 1, 1.5, 2, 3, 4];
  for (const n of whole) if (Math.abs(n - called) < called * 2 + 2) out.push({ qty: n, unit });
  // The sizes this ingredient is sold in, in the unit it is sold by.
  const sellUnit = unitsFor(ing).find((u) => u === 'lb' || u === 'oz' || u === 'kg' || u === 'g');
  if (sellUnit && sellUnit !== unit && canConvert(sellUnit, ing)) {
    const pounds = sellUnit === 'lb' || sellUnit === 'kg';
    for (const n of pounds ? [0.5, 1, 1.5, 2] : [8, 12, 16]) out.push({ qty: n, unit: sellUnit });
  }
  return out;
}

/** The "scale to one ingredient" buttons for a line: a can, a pound, two pounds… */
export function scaleChoices(recipe: Recipe, ri: RecipeIngredient, ing: Ingredient, limit = 8): ScaleChoice[] {
  const seen = new Set<string>();
  const out: ScaleChoice[] = [];
  for (const c of candidates(ri.qty, ri.unit, ing)) {
    const key = `${c.qty}:${c.unit}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const factor = scaleToAmount(ri, ing, c.qty, c.unit);
    if (factor === undefined || factor <= 0 || factor > 8) continue;
    const servings = servingsAtScale(recipe, factor);
    if (servings < 0.5 || servings > 40) continue;
    out.push({ ...c, factor, servings, label: formatAmount(c.qty, c.unit) || `${c.qty} ${unitLabel(c.unit, c.qty)}` });
  }
  return out.sort((a, b) => a.factor - b.factor).slice(0, limit);
}
