// Seeds/upgrades built-in ingredients and recipes without clobbering user changes.
import { INGREDIENTS } from '../data/ingredients';
import { RECIPES, SEED_VERSION } from '../data/recipes';
import { db, type MealDB } from './schema';

export async function seedIfNeeded(database: MealDB = db): Promise<boolean> {
  const row = await database.kv.get('seedVersion');
  if (row && (row.value as number) >= SEED_VERSION) return false;

  await database.transaction('rw', [database.ingredients, database.recipes, database.kv], async () => {
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
