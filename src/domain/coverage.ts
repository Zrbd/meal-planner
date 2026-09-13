// "What can I make now?" — how much of a recipe the pantry already covers.
import { isUsableOn, recipeNeeds } from './stock';
import type { Ingredient, ISODate, LooseLevel, Recipe, StockLot } from './types';

export interface Coverage {
  ratio: number; // 0..1 weighted by ingredient value
  missing: string[]; // ingredientIds not fully covered
  canMake: boolean;
}

export function availableByIngredient(lots: StockLot[], date: ISODate): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lots) if (isUsableOn(l, date)) m.set(l.ingredientId, (m.get(l.ingredientId) ?? 0) + l.qty);
  return m;
}

export function recipeCoverage(
  recipe: Recipe,
  servings: number,
  available: Map<string, number>,
  looseLevel: Map<string, LooseLevel>,
  ingById: Map<string, Ingredient>,
): Coverage {
  const { needs } = recipeNeeds(recipe, servings, ingById);
  let total = 0;
  let have = 0;
  const missing: string[] = [];
  for (const [id, qty] of needs) {
    const ing = ingById.get(id);
    if (!ing) continue;
    const w = ing.valueWeight;
    total += w;
    if (ing.trackMode === 'loose') {
      if (looseLevel.get(id) === 'out') missing.push(id);
      else have += w;
      continue;
    }
    const avail = available.get(id) ?? 0;
    if (avail >= qty * 0.97) have += w;
    else {
      have += w * (qty > 0 ? avail / qty : 1);
      missing.push(id);
    }
  }
  return { ratio: total ? have / total : 1, missing, canMake: missing.length === 0 };
}
