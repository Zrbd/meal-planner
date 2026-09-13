import { INGREDIENTS } from '../src/data/ingredients';
import { RECIPES } from '../src/data/recipes';
import type { Ingredient, PlannedMeal, StockLot } from '../src/domain/types';

export const ingById = new Map<string, Ingredient>(INGREDIENTS.map((i) => [i.id, i]));
export const recipesById = new Map(RECIPES.map((r) => [r.id, r]));
export const ing = (id: string) => {
  const i = ingById.get(id);
  if (!i) throw new Error(`no ingredient ${id}`);
  return i;
};

let n = 0;
export function lot(ingredientId: string, qty: number, extra: Partial<StockLot> = {}): StockLot {
  n++;
  return { id: `lot${n}`, ingredientId, qty, location: 'fridge', addedAt: n, ...extra };
}

export function meal(recipeId: string, date: string, extra: Partial<PlannedMeal> = {}): PlannedMeal {
  n++;
  return { id: `m${n}`, recipeId, date, slot: 'dinner', servings: 4, status: 'planned', ...extra };
}
