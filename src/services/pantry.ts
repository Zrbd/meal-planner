// Pantry actions. Every change writes an InventoryTxn so usage can be forecast and undone.
import { afterUse, inferPackSize, isCrumb, openedStorage, packSizeOf } from '../domain/containers';
import { addDaysISO, todayISO } from '../domain/dates';
import { EPS, planDeduction, round3 } from '../domain/stock';
import type { ISODate, Ingredient, InventoryTxn, Location, LooseLevel, Package, StockLot } from '../domain/types';
import { db } from '../db/schema';
import { newId } from './ids';

export function defaultExpiry(ing: Ingredient, location: Location, from: ISODate = todayISO()): ISODate | undefined {
  const days = ing.shelfLife[location];
  return days ? addDaysISO(from, days) : undefined;
}

export const snapshot = (lot: StockLot): InventoryTxn['lotSnapshot'] => ({
  lotId: lot.id, expiresOn: lot.expiresOn, location: lot.location, addedAt: lot.addedAt,
  ...(lot.packSize ? { packSize: lot.packSize } : {}), ...(lot.opened ? { opened: true } : {}),
});

export async function addStock(
  ingredientId: string,
  qty: number,
  opts: { location?: Location; expiresOn?: ISODate | null; reason?: 'purchase' | 'adjust'; refId?: string; opened?: boolean } = {},
): Promise<string> {
  const ing = await db.ingredients.get(ingredientId);
  if (!ing) throw new Error('Unknown ingredient');
  const location = opts.location ?? ing.defaultLocation;
  const now = Date.now();
  const packSize = opts.opened ? undefined : inferPackSize(qty, ing);
  const lot: StockLot = {
    id: newId(), ingredientId, qty: round3(qty), location, addedAt: now,
    expiresOn: opts.expiresOn === null ? undefined : opts.expiresOn ?? defaultExpiry(ing, location),
    ...(packSize ? { packSize } : {}), ...(opts.opened ? { opened: true } : {}),
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

/**
 * Take from one lot inside a caller's transaction. Whole packages stay sealed; the rest of an opened
 * package becomes its own lot (fridge, shorter life) via a `moved` txn so undo can put it back.
 * Returns the amount removed from stock (crumbs left behind are cleared too).
 */
export async function takeFromLot(
  lot: StockLot,
  take: number,
  ing: Ingredient,
  o: { reason: InventoryTxn['reason']; refId?: string; at: number; today?: ISODate },
): Promise<number> {
  const r = afterUse(lot, take, ing, o.today ?? todayISO());
  const used = r.left <= EPS && !r.opened ? lot.qty : take;
  if (r.left <= EPS) await db.lots.delete(lot.id);
  else await db.lots.update(lot.id, { qty: r.left });
  await db.txns.add({ id: newId(), ingredientId: lot.ingredientId, delta: -round3(used), reason: o.reason, refId: o.refId, lotSnapshot: snapshot(lot), at: o.at });
  if (r.opened) {
    const opened: StockLot = {
      id: newId(), ingredientId: lot.ingredientId, qty: r.opened.qty, location: r.opened.location, addedAt: lot.addedAt, opened: true,
      ...(r.opened.expiresOn ? { expiresOn: r.opened.expiresOn } : {}),
    };
    await db.lots.add(opened);
    await db.txns.add({
      id: newId(), ingredientId: lot.ingredientId, delta: 0, reason: 'adjust', refId: o.refId, at: o.at,
      lotSnapshot: snapshot(opened), moved: { fromLotId: lot.id, qty: r.opened.qty },
    });
  }
  return used;
}

/** Undo the lot changes of a set of txns (restores taken amounts, folds opened remainders back). */
export async function restoreLots(txns: InventoryTxn[]): Promise<void> {
  for (const t of txns) {
    const snap = t.lotSnapshot;
    if (!snap || t.moved) continue;
    const existing = await db.lots.get(snap.lotId);
    if (existing) await db.lots.update(existing.id, { qty: round3(existing.qty - t.delta) });
    else
      await db.lots.add({
        id: snap.lotId, ingredientId: t.ingredientId, qty: round3(-t.delta), location: snap.location, addedAt: snap.addedAt,
        ...(snap.expiresOn ? { expiresOn: snap.expiresOn } : {}), ...(snap.packSize ? { packSize: snap.packSize } : {}), ...(snap.opened ? { opened: true } : {}),
      });
  }
  for (const t of txns) {
    if (!t.moved || !t.lotSnapshot) continue;
    const opened = await db.lots.get(t.lotSnapshot.lotId);
    if (opened) {
      const q = round3(opened.qty - t.moved.qty);
      if (q <= EPS) await db.lots.delete(opened.id);
      else await db.lots.update(opened.id, { qty: q });
    }
    const from = await db.lots.get(t.moved.fromLotId);
    if (from) await db.lots.update(from.id, { qty: round3(from.qty + t.moved.qty) });
  }
}

/** Remove qty FIFO (soonest-expiring first). reason 'adjust' counts toward usage; 'waste' doesn't. */
export async function useSome(ingredientId: string, qty: number, reason: 'adjust' | 'waste' = 'adjust'): Promise<number> {
  const now = Date.now();
  return db.transaction('rw', db.ingredients, db.lots, db.txns, async () => {
    const ing = await db.ingredients.get(ingredientId);
    const lots = await db.lots.where('ingredientId').equals(ingredientId).toArray();
    const { takes, missing } = planDeduction(lots, ingredientId, qty);
    for (const { lot, take } of takes) {
      if (ing) await takeFromLot(lot, take, ing, { reason, at: now });
      else {
        const left = round3(lot.qty - take);
        if (left <= EPS) await db.lots.delete(lot.id);
        else await db.lots.update(lot.id, { qty: left });
        await db.txns.add({ id: newId(), ingredientId, delta: -take, reason, lotSnapshot: snapshot(lot), at: now });
      }
    }
    return missing;
  });
}

/** Open one sealed package: it moves to where opened ones keep (fridge for cans) with a shorter use-by. */
export async function openPackage(lotId: string, today: ISODate = todayISO()): Promise<void> {
  await db.transaction('rw', db.ingredients, db.lots, db.txns, async () => {
    const lot = await db.lots.get(lotId);
    const ing = lot && (await db.ingredients.get(lot.ingredientId));
    if (!lot || !ing || lot.opened) return;
    const size = packSizeOf(lot, ing) ?? lot.qty;
    const storage = openedStorage(ing, lot, today);
    if (isCrumb(lot.qty - size, ing)) {
      await db.lots.update(lot.id, { opened: true, packSize: undefined, location: storage.location, expiresOn: storage.expiresOn });
      return;
    }
    const opened: StockLot = {
      id: newId(), ingredientId: lot.ingredientId, qty: size, location: storage.location, addedAt: lot.addedAt, opened: true,
      ...(storage.expiresOn ? { expiresOn: storage.expiresOn } : {}),
    };
    await db.lots.update(lot.id, { qty: round3(lot.qty - size), packSize: size });
    await db.lots.add(opened);
    await db.txns.add({ id: newId(), ingredientId: lot.ingredientId, delta: 0, reason: 'adjust', at: Date.now(), lotSnapshot: snapshot(opened), moved: { fromLotId: lot.id, qty: size } });
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

export interface UnitsDraft {
  unitAliases: Record<string, number>;
  packages: Package[];
  displayUnit?: string;
  openedShelfLife?: Partial<Record<Location, number>>;
}

/** Save the user's own units and package sizes; catalog updates won't overwrite them. */
export async function saveUnits(id: string, draft: UnitsDraft): Promise<void> {
  await db.ingredients.update(id, {
    unitAliases: draft.unitAliases,
    packages: draft.packages,
    displayUnit: draft.displayUnit && draft.unitAliases[draft.displayUnit] ? draft.displayUnit : undefined,
    openedShelfLife: draft.openedShelfLife,
    unitsEdited: true,
  });
}

/** Remember a package size you actually bought so it's suggested next time. */
export async function addPackageSize(id: string, qty: number, label: string): Promise<void> {
  await db.transaction('rw', db.ingredients, async () => {
    const ing = await db.ingredients.get(id);
    if (!ing || ing.packages.some((p) => Math.abs(p.qty - qty) < 0.5)) return;
    await db.ingredients.update(id, { packages: [...ing.packages, { label, qty: round3(qty) }], unitsEdited: true });
  });
}

export async function createIngredient(data: Omit<Ingredient, 'id' | 'source'> & { id?: string }): Promise<string> {
  const { slugify } = await import('./ids');
  let id = data.id ?? slugify(data.name);
  if (!id) id = newId();
  if (await db.ingredients.get(id)) id = `${id}-${newId().slice(0, 4)}`;
  await db.ingredients.add({ ...data, id, source: 'user' });
  return id;
}
