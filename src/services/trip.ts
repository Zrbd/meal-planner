// Finishing a shopping trip turns checked items into pantry stock.
import { todayISO } from '../domain/dates';
import type { ISODate, Location } from '../domain/types';
import { db } from '../db/schema';
import { newId } from './ids';
import { defaultExpiry } from './pantry';

export interface TripItem {
  key: string; // shopping state key
  ingredientId?: string;
  name: string;
  qty: number; // baseUnit
  location?: Location;
  expiresOn?: ISODate;
}

export async function finishTrip(range: [ISODate, ISODate], items: TripItem[]): Promise<string> {
  const tripId = newId();
  const now = Date.now();
  const today = todayISO();
  await db.transaction('rw', [db.ingredients, db.lots, db.loose, db.txns, db.shopping, db.trips], async () => {
    for (const item of items) {
      if (!item.ingredientId) continue;
      const ing = await db.ingredients.get(item.ingredientId);
      if (!ing) continue;
      if (ing.trackMode === 'loose') {
        await db.loose.put({ ingredientId: ing.id, level: 'plenty', updatedAt: now });
        continue;
      }
      if (item.qty <= 0) continue;
      const location = item.location ?? ing.defaultLocation;
      const lotId = newId();
      const expiresOn = item.expiresOn ?? defaultExpiry(ing, location, today);
      await db.lots.add({ id: lotId, ingredientId: ing.id, qty: item.qty, location, addedAt: now, expiresOn });
      await db.txns.add({
        id: newId(), ingredientId: ing.id, delta: item.qty, reason: 'purchase', refId: tripId, at: now,
        lotSnapshot: { lotId, expiresOn, location, addedAt: now },
      });
    }
    await db.shopping.bulkDelete(items.map((i) => i.key));
    await db.trips.add({
      id: tripId, range, finishedAt: now,
      lines: items.map((i) => ({ ingredientId: i.ingredientId, name: i.name, qty: i.qty })),
    });
  });
  return tripId;
}

/** Reverse a trip: removes the stock it added (whatever is left of it). */
export async function undoTrip(tripId: string): Promise<void> {
  await db.transaction('rw', [db.lots, db.txns, db.trips], async () => {
    const txns = await db.txns.where('refId').equals(tripId).toArray();
    for (const t of txns) if (t.lotSnapshot) await db.lots.delete(t.lotSnapshot.lotId);
    await db.txns.bulkDelete(txns.map((t) => t.id));
    await db.trips.delete(tripId);
  });
}
