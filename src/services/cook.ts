// Cooking deducts ingredients FIFO and can be undone exactly (lots restored from snapshots).
import { onHand, planDeduction, recipeNeeds, round3, EPS } from '../domain/stock';
import type { Ingredient, Recipe, StockLot } from '../domain/types';
import { db } from '../db/schema';
import { newId } from './ids';
import { restoreLots, takeFromLot } from './pantry';

export interface CookPreviewLine {
  ingredientId: string;
  need: number;
  have: number;
  loose: boolean;
}

export function previewCook(
  recipe: Recipe,
  servings: number,
  ingById: Map<string, Ingredient>,
  lots: StockLot[],
): CookPreviewLine[] {
  const { needs } = recipeNeeds(recipe, servings, ingById);
  return [...needs].map(([ingredientId, need]) => {
    const ing = ingById.get(ingredientId)!;
    return { ingredientId, need, have: onHand(lots, ingredientId), loose: ing.trackMode === 'loose' };
  });
}

/** amounts: ingredientId → base qty actually used. Defaults to the recipe's scaled needs. */
export async function cookRecipe(opts: {
  recipeId: string;
  servings: number;
  plannedMealId?: string;
  amounts?: Record<string, number>;
}): Promise<string> {
  const logId = newId();
  const now = Date.now();
  await db.transaction('rw', [db.recipes, db.ingredients, db.lots, db.txns, db.cookLogs, db.meals], async () => {
    const recipe = await db.recipes.get(opts.recipeId);
    if (!recipe) throw new Error('Recipe not found');
    const ingById = new Map((await db.ingredients.toArray()).map((i) => [i.id, i]));
    const amounts = opts.amounts
      ? new Map(Object.entries(opts.amounts))
      : recipeNeeds(recipe, opts.servings, ingById).needs;
    const used: { ingredientId: string; qty: number }[] = [];
    for (const [ingredientId, qty] of amounts) {
      const ing = ingById.get(ingredientId);
      if (!ing || ing.trackMode === 'loose' || qty <= EPS) continue;
      const lots = await db.lots.where('ingredientId').equals(ingredientId).toArray();
      const { takes } = planDeduction(lots, ingredientId, qty);
      let total = 0;
      // Crumbs are cleared; the rest of an opened can/head splits into its own opened lot.
      for (const { lot, take } of takes) total += await takeFromLot(lot, take, ing, { reason: 'cook', refId: logId, at: now });
      used.push({ ingredientId, qty: round3(total) });
    }
    await db.cookLogs.add({ id: logId, recipeId: recipe.id, plannedMealId: opts.plannedMealId, at: now, used });
    if (opts.plannedMealId) await db.meals.update(opts.plannedMealId, { status: 'cooked', cookedAt: now });
  });
  return logId;
}

export async function undoCook(logId: string): Promise<void> {
  await db.transaction('rw', [db.lots, db.txns, db.cookLogs, db.meals], async () => {
    const txns = await db.txns.where('refId').equals(logId).toArray();
    await restoreLots(txns);
    await db.txns.bulkDelete(txns.map((t) => t.id));
    const log = await db.cookLogs.get(logId);
    await db.cookLogs.delete(logId);
    if (log?.plannedMealId) {
      const meal = await db.meals.get(log.plannedMealId);
      if (meal) {
        const { cookedAt: _drop, ...rest } = meal;
        void _drop;
        await db.meals.put({ ...rest, status: 'planned' });
      }
    }
  });
}
