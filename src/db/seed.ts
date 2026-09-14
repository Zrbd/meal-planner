// Seeds/upgrades built-in ingredients and recipes without clobbering user changes.
import { INGREDIENTS } from '../data/ingredients';
import { RECIPES, SEED_VERSION } from '../data/recipes';
import { db, type MealDB } from './schema';

export async function seedIfNeeded(database: MealDB = db): Promise<boolean> {
  const row = await database.kv.get('seedVersion');
  if (row && (row.value as number) >= SEED_VERSION) return false;

  const tables = [database.ingredients, database.recipes, database.lots, database.meals, database.cookLogs, database.kv];
  await database.transaction('rw', tables, async () => {
    const existingIngs = new Map((await database.ingredients.toArray()).map((i) => [i.id, i]));
    await database.ingredients.bulkPut(
      INGREDIENTS.map((seed) => {
        const cur = existingIngs.get(seed.id);
        if (!cur) return seed;
        // keep the user's personal tracking preferences
        return {
          ...seed,
          keepStocked: cur.keepStocked,
          lowThreshold: cur.lowThreshold,
          defaultLocation: cur.defaultLocation,
          category: cur.category ?? seed.category,
        };
      }),
    );

    const existingRecipes = new Map((await database.recipes.toArray()).map((r) => [r.id, r]));
    const now = Date.now();
    await database.recipes.bulkPut(
      RECIPES.filter((r) => !existingRecipes.get(r.id)?.userEdited).map((seed) => {
        const cur = existingRecipes.get(seed.id);
        return {
          ...seed,
          favorite: cur?.favorite ?? false,
          rating: cur?.rating,
          archived: cur?.archived ?? false,
          createdAt: cur?.createdAt ?? now,
          updatedAt: now,
        };
      }),
    );

    // Built-ins dropped from the catalog: delete them, unless history still points at them.
    const seedRecipeIds = new Set(RECIPES.map((r) => r.id));
    const meals = await database.meals.toArray();
    const logs = await database.cookLogs.toArray();
    const referenced = new Set([...meals.map((m) => m.recipeId), ...logs.map((l) => l.recipeId)]);
    for (const r of existingRecipes.values()) {
      if (r.source !== 'builtin' || r.userEdited || seedRecipeIds.has(r.id)) continue;
      // planned (not yet cooked) meals for a removed recipe are dropped; cooked history is kept
      const planned = meals.filter((m) => m.recipeId === r.id && m.status === 'planned');
      await database.meals.bulkDelete(planned.map((m) => m.id));
      const stillUsed = meals.some((m) => m.recipeId === r.id && m.status !== 'planned') || logs.some((l) => l.recipeId === r.id);
      if (stillUsed || (referenced.has(r.id) && !planned.length)) await database.recipes.update(r.id, { archived: true });
      else await database.recipes.delete(r.id);
    }

    const seedIngIds = new Set(INGREDIENTS.map((i) => i.id));
    const recipesNow = await database.recipes.toArray();
    const usedIngs = new Set(recipesNow.flatMap((r) => r.ingredients.map((i) => i.ingredientId)));
    const lotIngs = new Set((await database.lots.toArray()).map((l) => l.ingredientId));
    for (const ing of existingIngs.values()) {
      if (ing.source !== 'builtin' || seedIngIds.has(ing.id)) continue;
      if (!usedIngs.has(ing.id) && !lotIngs.has(ing.id)) await database.ingredients.delete(ing.id);
    }

    await database.kv.put({ key: 'seedVersion', value: SEED_VERSION });
  });
  return true;
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
