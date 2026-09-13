// Pantry actions. Every change writes an InventoryTxn so usage can be forecast and undone.
import { addDaysISO, todayISO } from '../domain/dates';
import { EPS, planDeduction, round3 } from '../domain/stock';
import type { ISODate, Ingredient, InventoryTxn, Location, LooseLevel, StockLot } from '../domain/types';
import { db } from '../db/schema';
import { newId } from './ids';

export function defaultExpiry(ing: Ingredient, location: Location, from: ISODate = todayISO()): ISODate | undefined {
  const days = ing.shelfLife[location];
  return days ? addDaysISO(from, days) : undefined;
}

const snapshot = (lot: StockLot): InventoryTxn['lotSnapshot'] => ({
  lotId: lot.id, expiresOn: lot.expiresOn, location: lot.location, addedAt: lot.addedAt,
});

export async function addStock(
  ingredientId: string,
  qty: number,
  opts: { location?: Location; expiresOn?: ISODate | null; reason?: 'purchase' | 'adjust'; refId?: string } = {},
): Promise<string> {
  const ing = await db.ingredients.get(ingredientId);
  if (!ing) throw new Error('Unknown ingredient');
  const location = opts.location ?? ing.defaultLocation;
  const now = Date.now();
  const lot: StockLot = {
    id: newId(), ingredientId, qty: round3(qty), location, addedAt: now,
    expiresOn: opts.expiresOn === null ? undefined : opts.expiresOn ?? defaultExpiry(ing, location),
  };
  await db.transaction('rw', db.lots, db.txns, async () => {
    await db.lots.add(lot);
    await db.txns.add({
      id: newId(), ingredientId, delta: lot.qty, reason: opts.reason ?? 'purchase', refId: opts.refId,
      lotSnapshot: snapshot(lot), at: now,
    });
  });
  return lot.id;
}

/** Remove qty FIFO (soonest-expiring first). reason 'adjust' counts toward usage; 'waste' doesn't. */
export async function useSome(ingredientId: string, qty: number, reason: 'adjust' | 'waste' = 'adjust'): Promise<number> {
  const now = Date.now();
  return db.transaction('rw', db.lots, db.txns, async () => {
    const lots = await db.lots.where('ingredientId').equals(ingredientId).toArray();
    const { takes, missing } = planDeduction(lots, ingredientId, qty);
    for (const { lot, take } of takes) {
      const left = round3(lot.qty - take);
      if (left <= EPS) await db.lots.delete(lot.id);
      else await db.lots.update(lot.id, { qty: left });
      await db.txns.add({ id: newId(), ingredientId, delta: -take, reason, lotSnapshot: snapshot(lot), at: now });
    }
    return missing;
  });
}

export async function setAmount(ingredientId: string, total: number): Promise<void> {
  const lots = await db.lots.where('ingredientId').equals(ingredientId).toArray();
  const current = lots.reduce((s, l) => s + l.qty, 0);
  const diff = round3(total - current);
  if (Math.abs(diff) <= EPS) return;
  if (diff > 0) await addStock(ingredientId, diff, { reason: 'adjust' });
  else await useSome(ingredientId, -diff, 'adjust');
}

export async function ranOut(ingredientId: string): Promise<void> {
  const lots = await db.lots.where('ingredientId').equals(ingredientId).toArray();
  const total = lots.reduce((s, l) => s + l.qty, 0);
  if (total > 0) await useSome(ingredientId, total, 'adjust');
}

export async function tossLot(lotId: string): Promise<void> {
  await db.transaction('rw', db.lots, db.txns, async () => {
    const lot = await db.lots.get(lotId);
    if (!lot) return;
    await db.lots.delete(lotId);
    await db.txns.add({ id: newId(), ingredientId: lot.ingredientId, delta: -lot.qty, reason: 'waste', lotSnapshot: snapshot(lot), at: Date.now() });
  });
}

export async function updateLot(lotId: string, patch: Partial<Pick<StockLot, 'location' | 'expiresOn'>>): Promise<void> {
  await db.lots.update(lotId, patch);
}

export async function moveLot(lotId: string, location: Location): Promise<void> {
  const lot = await db.lots.get(lotId);
  const ing = lot && (await db.ingredients.get(lot.ingredientId));
  if (!lot || !ing) return;
  // Freezing extends life; thawing to fridge shortens it.
  const expiresOn = location === lot.location ? lot.expiresOn : defaultExpiry(ing, location) ?? lot.expiresOn;
  await db.lots.update(lotId, { location, expiresOn });
}

export async function setLooseLevel(ingredientId: string, level: LooseLevel | null): Promise<void> {
  if (level === null) await db.loose.delete(ingredientId);
  else await db.loose.put({ ingredientId, level, updatedAt: Date.now() });
}

export async function updateIngredient(id: string, patch: Partial<Ingredient>): Promise<void> {
  await db.ingredients.update(id, patch);
}

export async function createIngredient(data: Omit<Ingredient, 'id' | 'source'> & { id?: string }): Promise<string> {
  const { slugify } = await import('./ids');
  let id = data.id ?? slugify(data.name);
  if (!id) id = newId();
  if (await db.ingredients.get(id)) id = `${id}-${newId().slice(0, 4)}`;
  await db.ingredients.add({ ...data, id, source: 'user' });
  return id;
}
