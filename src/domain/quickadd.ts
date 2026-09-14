// "Quick add": recipes you can make on a given day using only what's already in the kitchen,
// after setting aside everything earlier planned meals will use.
import { addDaysISO } from './dates';
import { buildDemands, simulate } from './stock';
import type { Ingredient, ISODate, LooseStock, PlannedMeal, Recipe, Slot, StockLot } from './types';

export interface CookableInput {
  recipes: Recipe[];
  date: ISODate;
  slot: Slot;
  servings: number;
  meals: PlannedMeal[];
  lots: StockLot[];
  loose: LooseStock[];
  ingById: Map<string, Ingredient>;
  today: ISODate;
}

export interface Cookable {
  recipe: Recipe;
  /** How many ingredients it uses that go bad within 3 days of the meal. */
  expiring: number;
}

const QUICK_ID = '__quick__';

export function cookableRecipes(input: CookableInput): Cookable[] {
  const { ingById, date } = input;
  const recipesById = new Map(input.recipes.map((r) => [r.id, r]));
  const upcoming = input.meals.filter((m) => m.date >= input.today && m.status === 'planned' && !m.leftoverOf);
  const base = buildDemands(upcoming, recipesById, ingById).demands;
  const shortTotal = (s: Map<string, number>) => [...s.values()].reduce((a, b) => a + b, 0);
  const baseShort = shortTotal(simulate(input.lots, input.loose, base, ingById).shortfalls);
  const stocked = new Set(input.lots.filter((l) => l.qty > 0).map((l) => l.ingredientId));
  const looseOut = new Set(input.loose.filter((l) => l.level === 'out').map((l) => l.ingredientId));
  const soon = addDaysISO(date, 3);

  const out: Cookable[] = [];
  for (const recipe of input.recipes) {
    if (recipe.archived) continue;
    // cheap pre-check before the full simulation
    const required = recipe.ingredients.filter((i) => !i.optional).map((i) => ingById.get(i.ingredientId));
    if (required.some((ing) => !ing || (!ing.alwaysOnHand && (ing.trackMode === 'exact' ? !stocked.has(ing.id) : looseOut.has(ing.id))))) continue;

    const meal: PlannedMeal = { id: QUICK_ID, date, slot: input.slot, recipeId: recipe.id, servings: input.servings, status: 'planned' };
    const { demands } = buildDemands([meal], new Map([[recipe.id, recipe]]), ingById);
    const sim = simulate(input.lots, input.loose, [...base, ...demands], ingById);
    // short itself, or it would eat food a later planned meal is counting on
    if (demands.some((dm) => (sim.shortfalls.get(dm.id) ?? 0) > 0) || shortTotal(sim.shortfalls) > baseShort + 1e-6) continue;

    const ids = new Set(demands.map((dm) => dm.ingredientId));
    const expiring = new Set(input.lots.filter((l) => ids.has(l.ingredientId) && l.expiresOn && l.expiresOn <= soon).map((l) => l.ingredientId)).size;
    out.push({ recipe, expiring });
  }
  return out.sort((a, b) => b.expiring - a.expiring || Number(b.recipe.favorite) - Number(a.recipe.favorite) || a.recipe.title.localeCompare(b.recipe.title));
}
