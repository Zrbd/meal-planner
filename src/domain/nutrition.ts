// Estimated nutrition for a recipe, a meal, or a whole planned day.
//
// Every number here is an estimate built from a per-100 g table plus the ingredient's own
// density / grams-per-each, so it is only ever as good as those. It is useful for "is this
// dinner 500 calories or 1200" and useless for anything medical, and the UI says so.
import { CATEGORY_MACROS, NUTRITION, type Macros } from '../data/nutrition';
import { toBase } from './units';
import type { Ingredient, PlannedMeal, Recipe } from './types';

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export const addNutrients = (a: Nutrients, b: Nutrients): Nutrients => ({
  kcal: a.kcal + b.kcal,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
});

export const scaleNutrients = (n: Nutrients, f: number): Nutrients => ({
  kcal: n.kcal * f,
  protein: n.protein * f,
  carbs: n.carbs * f,
  fat: n.fat * f,
});

/** Per-100 g macros for an ingredient: the table if we have it, otherwise its aisle average. */
export function macrosOf(ing: Ingredient): { macros: Macros; exact: boolean } {
  const hit = NUTRITION[ing.id];
  if (hit) return { macros: hit, exact: true };
  return { macros: CATEGORY_MACROS[ing.aisle] ?? CATEGORY_MACROS.other, exact: false };
}

/** Grams of an ingredient, given an amount already expressed in its base unit. */
export function gramsOfBase(base: number, ing: Ingredient): number {
  if (ing.baseUnit === 'g') return base;
  if (ing.baseUnit === 'ml') return base * (ing.density ?? 1);
  return base * (ing.gramsPerEach ?? 100);
}

export interface RecipeNutrition extends Nutrients {
  /** Per one serving at the requested serving count. */
  perServing: Nutrients;
  /** How many ingredients had a real table entry rather than an aisle average. */
  known: number;
  total: number;
  /** True when most of the recipe's weight came from real entries. */
  confident: boolean;
}

/**
 * Nutrition for a whole recipe scaled to `servings`. Optional ingredients are counted —
 * leaving them out only ever makes the real plate smaller than the estimate.
 */
export function recipeNutrition(
  recipe: Recipe,
  servings: number,
  ingById: Map<string, Ingredient>,
): RecipeNutrition {
  let total: Nutrients = ZERO;
  let known = 0;
  let count = 0;
  let knownGrams = 0;
  let allGrams = 0;
  const factor = recipe.baseServings > 0 ? servings / recipe.baseServings : 1;

  for (const ri of recipe.ingredients) {
    const ing = ingById.get(ri.ingredientId);
    if (!ing || ing.alwaysOnHand) continue;
    count += 1;
    let base: number;
    try {
      base = toBase(ri.qty, ri.unit, ing);
    } catch {
      continue;
    }
    const grams = gramsOfBase(base, ing) * factor;
    if (!Number.isFinite(grams) || grams <= 0) continue;
    const { macros, exact } = macrosOf(ing);
    if (exact) {
      known += 1;
      knownGrams += grams;
    }
    allGrams += grams;
    const per = grams / 100;
    total = addNutrients(total, {
      kcal: macros[0] * per,
      protein: macros[1] * per,
      carbs: macros[2] * per,
      fat: macros[3] * per,
    });
  }

  const each = servings > 0 ? scaleNutrients(total, 1 / servings) : ZERO;
  return {
    ...total,
    perServing: each,
    known,
    total: count,
    confident: allGrams > 0 && knownGrams / allGrams >= 0.7,
  };
}

export interface DayNutrition extends Nutrients {
  meals: { mealId: string; recipeId: string; nutrients: Nutrients }[];
}

/** What one person eats across a day: one serving of each meal planned for that day. */
export function dayNutrition(
  meals: PlannedMeal[],
  recipeById: Map<string, Recipe>,
  ingById: Map<string, Ingredient>,
): DayNutrition {
  let total: Nutrients = ZERO;
  const out: DayNutrition['meals'] = [];
  for (const m of meals) {
    if (m.status === 'skipped') continue;
    const r = recipeById.get(m.recipeId);
    if (!r) continue;
    // A meal planned for four feeds four; one person eats one serving of it.
    const share = recipeNutrition(r, m.servings, ingById).perServing;
    out.push({ mealId: m.id, recipeId: m.recipeId, nutrients: share });
    total = addNutrients(total, share);
  }
  return { ...total, meals: out };
}

export interface NutritionGoals {
  kcal?: number;
  protein?: number;
}

export type GoalVerdict = 'under' | 'on-track' | 'over';

/** Within ten percent of the goal counts as hitting it; nobody eats to the calorie. */
export function verdict(actual: number, goal: number | undefined): GoalVerdict | undefined {
  if (!goal || goal <= 0) return undefined;
  if (actual < goal * 0.9) return 'under';
  if (actual > goal * 1.1) return 'over';
  return 'on-track';
}

export const roundN = (n: number) => Math.round(n);

/** "620 cal · 38 g protein" */
export function summarize(n: Nutrients): string {
  return `${roundN(n.kcal)} cal · ${roundN(n.protein)} g protein`;
}
