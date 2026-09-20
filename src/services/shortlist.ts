// The cook-next queue.
import { add, move, parseShortlist, remove, type ShortlistEntry } from '../domain/shortlist';
import { db } from '../db/schema';

const KEY = 'shortlist';

async function read(): Promise<ShortlistEntry[]> {
  return parseShortlist((await db.kv.get(KEY))?.value);
}

export async function shortlistAdd(recipeId: string, note?: string): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await db.kv.put({ key: KEY, value: add(await read(), recipeId, Date.now(), note) });
  });
}

export async function shortlistRemove(recipeId: string): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await db.kv.put({ key: KEY, value: remove(await read(), recipeId) });
  });
}

/** Returns whether the recipe is on the list afterwards, for the button's state. */
export async function shortlistToggle(recipeId: string): Promise<boolean> {
  let on = false;
  await db.transaction('rw', db.kv, async () => {
    const list = await read();
    const has = list.some((e) => e.recipeId === recipeId);
    await db.kv.put({ key: KEY, value: has ? remove(list, recipeId) : add(list, recipeId, Date.now()) });
    on = !has;
  });
  return on;
}

export async function shortlistMove(from: number, to: number): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await db.kv.put({ key: KEY, value: move(await read(), from, to) });
  });
}

export async function shortlistClear(): Promise<void> {
  await db.kv.delete(KEY);
}
