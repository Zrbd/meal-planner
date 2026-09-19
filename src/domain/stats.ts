// Kitchen stats: what you actually cooked, what it cost, and what got thrown out.
// Pure reporting over cook logs, trips and inventory transactions.
import { daysBetween, toISODate } from './dates';
import type { CookLog, Ingredient, InventoryTxn, ISODate, Recipe, Trip } from './types';

export interface RecipeTally {
  recipeId: string;
  title: string;
  count: number;
  lastAt: number;
}

export interface Slice {
  label: string;
  count: number;
  share: number; // 0..1
}

export interface WasteLine {
  ingredientId: string;
  name: string;
  qty: number;
  events: number;
  cost?: number;
}

export interface KitchenStats {
  cooks: number;
  cooks30: number;
  distinctRecipes: number;
  /** Consecutive days ending today (or yesterday) with at least one cook. */
  streak: number;
  bestStreak: number;
  top: RecipeTally[];
  cuisines: Slice[];
  proteins: Slice[];
  /** Days with a cook, by ISO date, over the window. */
  byDay: Map<ISODate, number>;
  spend: number;
  trips: number;
  costPerCook?: number;
  waste: WasteLine[];
  wasteCost: number;
}

const dayOf = (at: number): ISODate => toISODate(new Date(at));

function slices(counts: Map<string, number>, total: number, max: number): Slice[] {
  return [...counts]
    .filter(([label]) => !!label)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([label, count]) => ({ label, count, share: total ? count / total : 0 }));
}

/** Longest run of consecutive cooking days, and the run that is still alive today. */
export function streaks(days: ISODate[], today: ISODate): { current: number; best: number } {
  const uniq = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: ISODate | null = null;
  let current = 0;
  for (const d of uniq) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  // A streak stays alive on the day after the last cook — you have until bedtime.
  if (prev !== null) {
    const gap = daysBetween(prev, today);
    if (gap === 0 || gap === 1) current = run;
  }
  return { current, best };
}

export function kitchenStats(input: {
  cookLogs: CookLog[];
  recipeById: Map<string, Recipe>;
  ingById: Map<string, Ingredient>;
  trips: Trip[];
  txns: InventoryTxn[];
  prices: Map<string, number>;
  today: ISODate;
  now: number;
  /** Only count cooks in the last N days (undefined = all time). */
  days?: number;
}): KitchenStats {
  const { cookLogs, recipeById, ingById, today, now } = input;
  const cutoff = input.days ? now - input.days * 86_400_000 : 0;
  const logs = cookLogs.filter((c) => c.at >= cutoff);

  const tally = new Map<string, RecipeTally>();
  const cuisines = new Map<string, number>();
  const proteins = new Map<string, number>();
  const byDay = new Map<ISODate, number>();
  let cooks30 = 0;

  for (const log of logs) {
    const r = recipeById.get(log.recipeId);
    const title = r?.title ?? 'Deleted recipe';
    const t = tally.get(log.recipeId) ?? { recipeId: log.recipeId, title, count: 0, lastAt: 0 };
    tally.set(log.recipeId, { ...t, title, count: t.count + 1, lastAt: Math.max(t.lastAt, log.at) });
    if (r?.cuisine) cuisines.set(r.cuisine, (cuisines.get(r.cuisine) ?? 0) + 1);
    if (r?.protein) proteins.set(r.protein, (proteins.get(r.protein) ?? 0) + 1);
    const day = dayOf(log.at);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    if (now - log.at <= 30 * 86_400_000) cooks30++;
  }

  const { current, best } = streaks([...byDay.keys()], today);

  const trips = input.trips.filter((t) => t.finishedAt >= cutoff);
  const spend = trips.reduce((s, t) => s + t.lines.reduce((x, l) => x + (l.price ?? 0), 0), 0);

  const wasteMap = new Map<string, WasteLine>();
  let wasteCost = 0;
  for (const txn of input.txns) {
    if (txn.reason !== 'waste' || txn.at < cutoff || txn.delta >= 0) continue;
    const ing = ingById.get(txn.ingredientId);
    const qty = -txn.delta;
    const line = wasteMap.get(txn.ingredientId) ?? {
      ingredientId: txn.ingredientId, name: ing?.name ?? txn.ingredientId, qty: 0, events: 0,
    };
    const unit = input.prices.get(txn.ingredientId);
    const cost = unit ? unit * qty : undefined;
    if (cost) wasteCost += cost;
    wasteMap.set(txn.ingredientId, {
      ...line, qty: line.qty + qty, events: line.events + 1,
      cost: cost === undefined ? line.cost : (line.cost ?? 0) + cost,
    });
  }

  const top = [...tally.values()].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);

  return {
    cooks: logs.length,
    cooks30,
    distinctRecipes: tally.size,
    streak: current,
    bestStreak: best,
    top: top.slice(0, 8),
    cuisines: slices(cuisines, logs.length, 6),
    proteins: slices(proteins, logs.length, 6),
    byDay,
    spend,
    trips: trips.length,
    costPerCook: logs.length && spend > 0 ? spend / logs.length : undefined,
    waste: [...wasteMap.values()].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0) || b.events - a.events).slice(0, 8),
    wasteCost,
  };
}
