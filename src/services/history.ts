// Recipe revisions: snapshot before each edit, restore on demand.
import { forgetHistory, parseHistory, pushRevision, type HistoryMap } from '../domain/history';
import type { Recipe } from '../domain/types';
import { db } from '../db/schema';

const KEY = 'recipeHistory';

async function read(): Promise<HistoryMap> {
  return parseHistory((await db.kv.get(KEY))?.value);
}

/**
 * Called from inside saveRecipe's transaction, so the snapshot and the edit it describes either
 * both land or neither does.
 */
export async function recordRevision(before: Recipe, after: Recipe): Promise<void> {
  const map = await read();
  await db.kv.put({ key: KEY, value: pushRevision(map, before, after, Date.now()) });
}

/** Put a recipe back the way it was — and snapshot the current version first, so revert undoes. */
export async function revertTo(recipeId: string, at: number): Promise<boolean> {
  let ok = false;
  await db.transaction('rw', db.kv, db.recipes, async () => {
    const map = await read();
    const rev = map[recipeId]?.find((r) => r.at === at);
    const current = await db.recipes.get(recipeId);
    if (!rev || !current) return;
    await db.recipes.put({ ...rev.snapshot, updatedAt: Date.now() });
    await db.kv.put({ key: KEY, value: pushRevision(map, current, rev.snapshot, Date.now()) });
    ok = true;
  });
  return ok;
}

export async function clearHistory(recipeId: string): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await db.kv.put({ key: KEY, value: forgetHistory(await read(), recipeId) });
  });
}
