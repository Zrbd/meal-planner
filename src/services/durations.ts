// How long cooks actually take.
import { parseDurations, record } from '../domain/durations';
import { db } from '../db/schema';

const KEY = 'cookDurations';
const START_KEY = 'cookStartedAt';

/** Cook mode opened. Stored rather than held in state so a lock screen does not lose it. */
export async function markCookStart(recipeId: string): Promise<void> {
  await db.kv.put({ key: START_KEY, value: { recipeId, at: Date.now() } });
}

export async function clearCookStart(): Promise<void> {
  await db.kv.delete(START_KEY);
}

/** Cook finished. Only counts when the running clock belongs to the recipe you finished. */
export async function recordCookDuration(recipeId: string): Promise<number | undefined> {
  let minutes: number | undefined;
  await db.transaction('rw', db.kv, async () => {
    const started = (await db.kv.get(START_KEY))?.value as { recipeId?: string; at?: number } | undefined;
    await db.kv.delete(START_KEY);
    if (started?.recipeId !== recipeId || typeof started.at !== 'number') return;
    const mins = (Date.now() - started.at) / 60_000;
    if (mins < 1) return;
    const map = parseDurations((await db.kv.get(KEY))?.value);
    await db.kv.put({ key: KEY, value: record(map, recipeId, mins, Date.now()) });
    minutes = Math.round(mins);
  });
  return minutes;
}

export async function forgetDurations(recipeId: string): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const next = { ...parseDurations((await db.kv.get(KEY))?.value) };
    delete next[recipeId];
    await db.kv.put({ key: KEY, value: next });
  });
}
