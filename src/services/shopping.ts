import type { ShoppingState } from '../domain/types';
import { db } from '../db/schema';
import { newId } from './ids';

export async function patchShoppingState(key: string, patch: Partial<Omit<ShoppingState, 'key'>>): Promise<void> {
  await db.transaction('rw', db.shopping, async () => {
    const cur = await db.shopping.get(key);
    await db.shopping.put({ key, checked: false, ...cur, ...patch });
  });
}

export async function toggleChecked(key: string): Promise<void> {
  const cur = await db.shopping.get(key);
  await patchShoppingState(key, { checked: !cur?.checked });
}

export async function addManualItem(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.shopping.put({ key: `manual:${newId()}`, checked: false, manualName: trimmed });
}

export async function removeShoppingState(key: string): Promise<void> {
  await db.shopping.delete(key);
}

export async function clearChecked(): Promise<void> {
  const keys = await db.shopping.filter((s) => s.checked).primaryKeys();
  await db.shopping.bulkDelete(keys);
}

/** Tick or untick a whole aisle at once — one transaction, so the list doesn't flicker item by item. */
export async function setCheckedMany(keys: string[], checked: boolean): Promise<void> {
  if (!keys.length) return;
  await db.transaction('rw', db.shopping, async () => {
    const existing = await db.shopping.bulkGet(keys);
    await db.shopping.bulkPut(keys.map((key, i) => ({ ...existing[i], key, checked })));
  });
}
