import { db } from '../db/schema';

const KEY = 'stockCheck';

export interface StockCheckState {
  /** Ingredients you have already answered for, so the walkthrough doesn't ask twice. */
  done: string[];
  at?: number;
}

export async function getStockCheck(): Promise<StockCheckState> {
  const row = await db.kv.get(KEY);
  const v = row?.value as Partial<StockCheckState> | undefined;
  return { done: v?.done ?? [], at: v?.at };
}

/** Remember that an ingredient has been answered for (or deliberately left untracked). */
export async function markStockChecked(ids: string[]): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const cur = await getStockCheck();
    await db.kv.put({ key: KEY, value: { done: [...new Set([...cur.done, ...ids])], at: Date.now() } });
  });
}

/** Start the walkthrough over from the top. */
export async function resetStockCheck(): Promise<void> {
  await db.kv.put({ key: KEY, value: { done: [], at: Date.now() } });
}
