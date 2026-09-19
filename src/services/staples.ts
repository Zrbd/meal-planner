// The things that should simply always be in the house. `keepStocked` already existed per item,
// buried one screen deep per ingredient; this edits the whole set at once.
import { db } from '../db/schema';

export async function setKeepStocked(ingredientIds: string[], keep: boolean): Promise<void> {
  if (!ingredientIds.length) return;
  await db.transaction('rw', db.ingredients, async () => {
    for (const id of ingredientIds) await db.ingredients.update(id, { keepStocked: keep });
  });
}

/** Set the amount below which an item counts as low. `undefined` goes back to the default. */
export async function setLowThreshold(ingredientId: string, qty: number | undefined): Promise<void> {
  await db.ingredients.update(ingredientId, { lowThreshold: qty && qty > 0 ? qty : undefined });
}

/**
 * Turn the things you cook with most into staples in one go: anything used in at least
 * `minRecipes` of your planned-or-cooked meals that isn't already kept stocked.
 */
export async function suggestStaples(minRecipes = 4): Promise<string[]> {
  const [logs, recipes, ingredients] = await Promise.all([
    db.cookLogs.toArray(), db.recipes.toArray(), db.ingredients.toArray(),
  ]);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const counts = new Map<string, number>();
  for (const log of logs) {
    const r = byId.get(log.recipeId);
    if (!r) continue;
    for (const id of new Set(r.ingredients.map((ri) => ri.ingredientId))) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const kept = new Set(ingredients.filter((i) => i.keepStocked || i.alwaysOnHand).map((i) => i.id));
  return [...counts]
    .filter(([id, n]) => n >= minRecipes && !kept.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}
