// Prices: what you paid on shopping trips → cost per recipe and spending totals.
import { addDaysISO, toISODate } from './dates';
import { recipeNeeds } from './stock';
import type { Ingredient, ISODate, Recipe, Trip } from './types';

/** Latest price paid per base unit (g / ml / ea) for each ingredient. */
export function unitPrices(trips: Trip[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const trip of [...trips].sort((a, b) => b.finishedAt - a.finishedAt)) {
    for (const l of trip.lines) {
      if (!l.ingredientId || !l.price || l.price <= 0 || l.qty <= 0 || out.has(l.ingredientId)) continue;
      out.set(l.ingredientId, l.price / l.qty);
    }
  }
  return out;
}

export interface RecipeCost {
  total: number;
  /** Ingredients with a known price. */
  priced: number;
  /** Ingredients with no price yet (pantry staples like salt are ignored). */
  unpriced: number;
}

/** Cost of making a recipe, using the ingredient amounts it actually uses (not whole packages). */
export function recipeCost(recipe: Recipe, servings: number, ingById: Map<string, Ingredient>, prices: Map<string, number>): RecipeCost {
  const { needs } = recipeNeeds(recipe, servings, ingById);
  let total = 0;
  let priced = 0;
  let unpriced = 0;
  for (const [id, qty] of needs) {
    const ing = ingById.get(id);
    const p = prices.get(id);
    if (p !== undefined) {
      total += p * qty;
      priced++;
    } else if (ing && !ing.alwaysOnHand && ing.trackMode === 'exact') unpriced++;
  }
  return { total, priced, unpriced };
}

export interface Spending {
  week: number;
  month: number;
  total: number;
  trips: number;
}

/** Money spent on groceries: last 7 days, this calendar month, and all recorded trips. */
export function spending(trips: Trip[], today: ISODate): Spending {
  const weekStart = addDaysISO(today, -6);
  const month = today.slice(0, 7);
  const out: Spending = { week: 0, month: 0, total: 0, trips: 0 };
  for (const trip of trips) {
    const paid = trip.lines.reduce((s, l) => s + (l.price ?? 0), 0);
    if (paid <= 0) continue;
    const day = toISODate(new Date(trip.finishedAt));
    out.total += paid;
    out.trips++;
    if (day >= weekStart && day <= today) out.week += paid;
    if (day.startsWith(month)) out.month += paid;
  }
  return out;
}

export const money = (n: number) => `$${n.toFixed(2)}`;

export interface PricePoint {
  at: number;
  /** Price per base unit (g / ml / ea). */
  unit: number;
  /** What was actually paid for the whole amount bought. */
  paid: number;
  qty: number;
}

export interface PriceBookEntry {
  ingredientId: string;
  name: string;
  latest: number;
  /** Cheapest and dearest unit price ever recorded. */
  low: number;
  high: number;
  /** Change from the previous recorded price, as a fraction (0.2 = 20% dearer). */
  change?: number;
  points: PricePoint[];
}

/** Every price you have ever paid, newest first, per ingredient. */
export function priceHistory(trips: Trip[]): Map<string, PricePoint[]> {
  const out = new Map<string, PricePoint[]>();
  for (const trip of [...trips].sort((a, b) => b.finishedAt - a.finishedAt)) {
    for (const l of trip.lines) {
      if (!l.ingredientId || !l.price || l.price <= 0 || l.qty <= 0) continue;
      const list = out.get(l.ingredientId) ?? [];
      list.push({ at: trip.finishedAt, unit: l.price / l.qty, paid: l.price, qty: l.qty });
      out.set(l.ingredientId, list);
    }
  }
  return out;
}

/** The price book: what each thing costs, and whether it has gone up lately. */
export function priceBook(trips: Trip[], ingById: Map<string, Ingredient>): PriceBookEntry[] {
  const out: PriceBookEntry[] = [];
  for (const [ingredientId, points] of priceHistory(trips)) {
    const ing = ingById.get(ingredientId);
    if (!ing || !points.length) continue;
    const units = points.map((p) => p.unit);
    const latest = units[0];
    const previous = units[1];
    out.push({
      ingredientId,
      name: ing.name,
      latest,
      low: Math.min(...units),
      high: Math.max(...units),
      change: previous ? (latest - previous) / previous : undefined,
      points,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
