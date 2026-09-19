// What the food in your kitchen is worth, and what has been sitting there untouched.
import { addedOn } from './freshness';
import { daysBetween } from './dates';
import type { Ingredient, ISODate, Location, PlannedMeal, Recipe, StockLot } from './types';
import { recipeNeeds } from './stock';

export interface ValueByLocation {
  total: number;
  byLocation: Record<Location, number>;
  /** Share of stocked items we have no price for yet. */
  unpricedItems: number;
  pricedItems: number;
}

export function pantryValue(lots: StockLot[], prices: Map<string, number>): ValueByLocation {
  const byLocation: Record<Location, number> = { fridge: 0, freezer: 0, pantry: 0 };
  let total = 0;
  const priced = new Set<string>();
  const unpriced = new Set<string>();
  for (const l of lots) {
    const unit = prices.get(l.ingredientId);
    if (unit === undefined) {
      unpriced.add(l.ingredientId);
      continue;
    }
    priced.add(l.ingredientId);
    const v = unit * l.qty;
    total += v;
    byLocation[l.location] += v;
  }
  return { total, byLocation, pricedItems: priced.size, unpricedItems: unpriced.size };
}

export interface DeadStockItem {
  ingredientId: string;
  name: string;
  qty: number;
  location: Location;
  daysHeld: number;
  value?: number;
  /** Recipes you own that would use it up. */
  uses: Recipe[];
}

/**
 * Stock that has been in the kitchen a long time and is on no upcoming plan.
 * Freezer items get a longer leash — that is the point of a freezer.
 */
export function deadStock(input: {
  lots: StockLot[];
  ingById: Map<string, Ingredient>;
  recipes: Recipe[];
  meals: PlannedMeal[];
  prices: Map<string, number>;
  today: ISODate;
  minDays?: number;
  limit?: number;
}): DeadStockItem[] {
  const min = input.minDays ?? 45;
  const plannedIngredients = new Set<string>();
  const byId = new Map(input.recipes.map((r) => [r.id, r]));
  for (const m of input.meals) {
    if (m.date < input.today || m.status === 'skipped') continue;
    const r = byId.get(m.recipeId);
    if (r) for (const ri of r.ingredients) plannedIngredients.add(ri.ingredientId);
  }

  const held = new Map<string, { qty: number; oldest: ISODate; location: Location }>();
  for (const l of input.lots) {
    const ing = input.ingById.get(l.ingredientId);
    if (!ing || ing.alwaysOnHand || plannedIngredients.has(l.ingredientId)) continue;
    const day = addedOn(l);
    const cur = held.get(l.ingredientId);
    held.set(l.ingredientId, {
      qty: (cur?.qty ?? 0) + l.qty,
      oldest: cur && cur.oldest < day ? cur.oldest : day,
      location: cur?.location ?? l.location,
    });
  }

  const out: DeadStockItem[] = [];
  for (const [id, h] of held) {
    const ing = input.ingById.get(id)!;
    const daysHeld = daysBetween(h.oldest, input.today);
    const threshold = h.location === 'freezer' ? min * 2 : min;
    if (daysHeld < threshold) continue;
    const unit = input.prices.get(id);
    out.push({
      ingredientId: id,
      name: ing.name,
      qty: h.qty,
      location: h.location,
      daysHeld,
      value: unit === undefined ? undefined : unit * h.qty,
      uses: input.recipes
        .filter((r) => !r.archived && r.ingredients.some((ri) => ri.ingredientId === id))
        .slice(0, 3),
    });
  }
  return out.sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || b.daysHeld - a.daysHeld).slice(0, input.limit ?? 12);
}

export interface IngredientMatch {
  recipe: Recipe;
  /** How many of the chosen ingredients this recipe uses. */
  hits: number;
  hitIds: string[];
  /** Share of the recipe's own ingredient list that the chosen ones cover. */
  density: number;
  score: number;
}

/** "I have these three things — what can I make?" Ranked by how central the picks are. */
export function recipesUsing(input: {
  ingredientIds: string[];
  recipes: Recipe[];
  ingById: Map<string, Ingredient>;
  servings?: number;
  limit?: number;
}): IngredientMatch[] {
  const want = new Set(input.ingredientIds);
  if (!want.size) return [];
  const out: IngredientMatch[] = [];
  for (const r of input.recipes) {
    if (r.archived) continue;
    const { needs } = recipeNeeds(r, input.servings ?? r.baseServings, input.ingById);
    const hitIds = [...needs.keys()].filter((id) => want.has(id));
    if (!hitIds.length) continue;
    const density = needs.size ? hitIds.length / needs.size : 0;
    out.push({ recipe: r, hits: hitIds.length, hitIds, density, score: hitIds.length * 2 + density * 3 });
  }
  return out.sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title)).slice(0, input.limit ?? 40);
}
