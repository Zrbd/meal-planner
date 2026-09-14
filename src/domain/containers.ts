// Packages vs. what's been opened. A lot of sealed cans stays sealed until you use some;
// the rest of a partly used package becomes its own "opened" lot with a shorter life.
// Package sizes and unit names come from the ingredient (packages + unitAliases), which the user can edit.
import { addDaysISO } from './dates';
import { EPS, round3 } from './stock';
import type { Ingredient, ISODate, Location, StockLot, UnitSystem } from './types';
import { formatQty, pluralize } from './units';

const TOL = 0.03;

/** How long an opened package keeps, by location. Canned goods default to 4 days in the fridge. */
export function openedLife(ing: Ingredient): Partial<Record<Location, number>> | undefined {
  if (ing.openedShelfLife && Object.keys(ing.openedShelfLife).length) return ing.openedShelfLife;
  if (ing.aisle === 'canned') return { fridge: 4, freezer: 60 };
  return undefined;
}

/** Leftover too small to keep track of. */
export const isCrumb = (qty: number, ing: Ingredient) => qty <= (ing.baseUnit === 'ea' ? 0.05 : 0.5);

/** The package size qty is a whole number of (largest first), if any. */
export function inferPackSize(qty: number, ing: Ingredient): number | undefined {
  const sizes = [...new Set(ing.packages.map((p) => p.qty).filter((s) => s > 0))].sort((a, b) => b - a);
  for (const s of sizes) {
    const n = qty / s;
    const r = Math.round(n);
    if (r >= 1 && Math.abs(n - r) <= TOL) return s;
  }
  return undefined;
}

export const packSizeOf = (lot: StockLot, ing: Ingredient) => (lot.opened ? undefined : lot.packSize ?? inferPackSize(lot.qty, ing));

/** Whole sealed packages in a lot and whatever doesn't fill one. */
export function splitPacks(qty: number, size: number): { packs: number; rest: number } {
  const packs = Math.max(0, Math.floor(qty / size + TOL));
  const rest = round3(qty - packs * size);
  return rest < 0 ? { packs, rest: 0 } : { packs, rest };
}

/** Where an opened package goes and when it's done. */
export function openedStorage(ing: Ingredient, from: Pick<StockLot, 'location' | 'expiresOn'>, today: ISODate): { location: Location; expiresOn?: ISODate } {
  const life = openedLife(ing);
  if (!life) return { location: from.location, expiresOn: from.expiresOn };
  const location: Location = life[from.location] ? from.location : life.fridge ? 'fridge' : from.location;
  const days = life[location];
  if (!days) return { location, expiresOn: from.expiresOn };
  const opened = addDaysISO(today, days);
  return { location, expiresOn: from.expiresOn && from.expiresOn < opened ? from.expiresOn : opened };
}

export interface AfterUse {
  /** What stays in the original lot (sealed packages). 0 = remove the lot. */
  left: number;
  /** The rest of the package that was opened. */
  opened?: { qty: number; location: Location; expiresOn?: ISODate };
}

/** Result of taking `take` from a lot: sealed packages stay put, the opened remainder splits off. */
export function afterUse(lot: StockLot, take: number, ing: Ingredient, today: ISODate): AfterUse {
  const left = round3(lot.qty - take);
  if (left <= EPS || isCrumb(left, ing)) return { left: 0 };
  const size = packSizeOf(lot, ing);
  if (!size) return { left };
  const { packs, rest } = splitPacks(left, size);
  if (isCrumb(rest, ing)) return { left };
  return { left: round3(packs * size), opened: { qty: rest, ...openedStorage(ing, lot, today) } };
}

/** Name for one package of `size`: a unit ("can", "head") or a package label ("32 oz carton"). */
export function packName(ing: Ingredient, size: number, count = 1): string {
  const near = (a: number) => Math.abs(a - size) <= size * 0.02;
  const alias = Object.entries(ing.unitAliases ?? {}).find(([, v]) => near(v))?.[0];
  const label = alias ?? ing.packages.find((p) => near(p.qty))?.label ?? formatQty(size, ing);
  return count > 1 ? label.replace(/([A-Za-z]+)(\)?)$/, (_, w: string, p: string) => pluralize(w) + p) : label;
}

export interface StockParts {
  sealed: { size: number; count: number }[];
  opened: number;
  other: number;
}

export function stockParts(lots: StockLot[], ing: Ingredient): StockParts {
  const sealed = new Map<number, number>();
  let opened = 0;
  let other = 0;
  for (const l of lots) {
    if (l.ingredientId !== ing.id || l.qty <= EPS) continue;
    if (l.opened) {
      opened += l.qty;
      continue;
    }
    const size = packSizeOf(l, ing);
    if (!size) {
      other += l.qty;
      continue;
    }
    const { packs, rest } = splitPacks(l.qty, size);
    if (packs) sealed.set(size, (sealed.get(size) ?? 0) + packs);
    other += rest;
  }
  return {
    sealed: [...sealed].sort((a, b) => b[0] - a[0]).map(([size, count]) => ({ size, count })),
    opened: round3(opened),
    other: round3(other),
  };
}

/** "2 cans + ½ can open", "1 head + 7 cloves open", or just "1½ cups". */
export function describeStock(lots: StockLot[], ing: Ingredient, system: UnitSystem = 'us'): string {
  const p = stockParts(lots, ing);
  const bits = p.sealed.map((s) => `${s.count} ${packName(ing, s.size, s.count)}`);
  const extra = p.other;
  if (!p.sealed.length && !p.opened) return formatQty(extra, ing, system);
  if (extra > EPS && !isCrumb(extra, ing)) bits.push(formatQty(extra, ing, system));
  if (p.opened > EPS) bits.push(`${formatQty(p.opened, ing, system)} open`);
  return bits.join(' + ');
}
