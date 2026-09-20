// Kitchen timers live in kv rather than component state so they survive the screen locking,
// the app being backgrounded, and you wandering off to answer the door.
import { MAX_TIMERS, parseTimers, pause as pauseFn, resume as resumeFn, nudge as nudgeFn, type KitchenTimer } from '../domain/timers';
import { db } from '../db/schema';
import { newId } from './ids';

const KEY = 'timers';

async function read(): Promise<KitchenTimer[]> {
  return parseTimers((await db.kv.get(KEY))?.value);
}

async function write(list: KitchenTimer[]): Promise<void> {
  await db.kv.put({ key: KEY, value: list.slice(0, MAX_TIMERS) });
}

export async function startTimer(label: string, seconds: number, recipeId?: string): Promise<string | undefined> {
  const id = newId();
  let created: string | undefined;
  await db.transaction('rw', db.kv, async () => {
    const list = await read();
    if (list.length >= MAX_TIMERS) return;
    const now = Date.now();
    await write([...list, { id, label, seconds, endsAt: now + seconds * 1000, recipeId, createdAt: now }]);
    created = id;
  });
  return created;
}

export async function stopTimer(id: string): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await write((await read()).filter((t) => t.id !== id));
  });
}

export async function clearTimers(): Promise<void> {
  await db.kv.delete(KEY);
}

async function mutate(id: string, fn: (t: KitchenTimer) => KitchenTimer): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await write((await read()).map((t) => (t.id === id ? fn(t) : t)));
  });
}

export async function pauseTimer(id: string): Promise<void> {
  await mutate(id, (t) => pauseFn(t, Date.now()));
}

export async function resumeTimer(id: string): Promise<void> {
  await mutate(id, (t) => resumeFn(t, Date.now()));
}

/** Plus or minus a minute, for when the onions are not there yet. */
export async function nudgeTimer(id: string, deltaSeconds: number): Promise<void> {
  await mutate(id, (t) => nudgeFn(t, deltaSeconds, Date.now()));
}
