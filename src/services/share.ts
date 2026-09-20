// Importing a single recipe someone sent you.
import { copyId, parseShared, type ImportResult } from '../domain/share';
import { db } from '../db/schema';

/** Parse and check a .recipe.json file against this device's catalog. */
export async function inspectShared(text: string): Promise<ImportResult> {
  const [recipes, ingredients] = await Promise.all([db.recipes.toArray(), db.ingredients.toArray()]);
  return parseShared(text, new Set(recipes.map((r) => r.id)), new Map(ingredients.map((i) => [i.id, i])));
}

/**
 * Write it in. `mode` decides what happens when you already have a recipe with that id:
 * 'copy' keeps both, 'replace' overwrites yours.
 */
export async function importShared(result: ImportResult, mode: 'copy' | 'replace' = 'copy'): Promise<string> {
  const now = Date.now();
  return db.transaction('rw', db.recipes, db.ingredients, async () => {
    for (const ing of result.newIngredients) {
      if (!(await db.ingredients.get(ing.id))) await db.ingredients.add({ ...ing, source: 'user' });
    }
    const recipe = result.shared.recipe;
    let id = recipe.id;
    if (result.collides && mode === 'copy') {
      const existing = new Set((await db.recipes.toArray()).map((r) => r.id));
      id = copyId(recipe.id, existing);
    }
    await db.recipes.put({
      ...recipe,
      id,
      source: 'user',
      userEdited: false,
      favorite: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  });
}
