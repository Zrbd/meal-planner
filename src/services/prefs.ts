// Small per-recipe memories: what you last looked at, and how much of it you actually make.
import { db } from '../db/schema';
import { getSettings, updateSettings } from '../db/settings';
import { parseRecent, pushRecent } from '../domain/recent';

const RECENT_KEY = 'recent';

/** Called when a recipe screen opens. Cheap enough to fire on every view. */
export async function touchRecipe(recipeId: string): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const list = parseRecent((await db.kv.get(RECENT_KEY))?.value);
    if (list[0] === recipeId) return;
    await db.kv.put({ key: RECENT_KEY, value: pushRecent(list, recipeId) });
  });
}

export async function clearRecent(): Promise<void> {
  await db.kv.delete(RECENT_KEY);
}

/**
 * Remember the serving count you chose for a recipe. Recipes are written for four; a household
 * of two retypes that number every single time otherwise.
 */
export async function rememberServings(recipeId: string, servings: number): Promise<void> {
  const current = await getSettings();
  if (current.recipeServings?.[recipeId] === servings) return;
  await updateSettings({ recipeServings: { ...(current.recipeServings ?? {}), [recipeId]: servings } });
}

export async function forgetServings(recipeId: string): Promise<void> {
  const current = await getSettings();
  const next = { ...(current.recipeServings ?? {}) };
  delete next[recipeId];
  await updateSettings({ recipeServings: next });
}
