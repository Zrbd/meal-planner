// Low-stock detection, usage-rate forecasts, and expiry alerts.
import { addDaysISO, daysBetween, nextShoppingDay, relativeDayLabel } from './dates';
import { thawNeeds, useUpCandidates } from './freshness';
import { buildDemands, negligible, onHand, simulate } from './stock';
import type { Ingredient, InventoryTxn, ISODate, LooseStock, PlannedMeal, Recipe, StockLot } from './types';

const DAY_MS = 86_400_000;

/** Average daily consumption (baseUnit/day) over the last 28 days, last 14 days weighted ×2. Waste excluded. */
export function usageRate(txns: InventoryTxn[], ingredientId: string, now: number): number {
  const mine = txns.filter((t) => t.ingredientId === ingredientId);
  if (!mine.length) return 0;
  const firstAt = Math.min(...mine.map((t) => t.at));
  const windowDays = Math.min(28, Math.max(7, (now - firstAt) / DAY_MS));
  let sum = 0;
  for (const t of mine) {
    const consumed = t.reason === 'cook' || (t.reason === 'adjust' && t.delta < 0);
    if (!consumed) continue;
    const age = (now - t.at) / DAY_MS;
    if (age > windowDays) continue;
    sum += Math.abs(t.delta) * (age <= 14 ? 2 : 1);
  }
  const effDays = windowDays + Math.min(windowDays, 14);
  return sum / effDays;
}

export function effectiveThreshold(ing: Ingredient, dailyRate: number, bufferDays: number): number {
  if (ing.lowThreshold !== undefined) return ing.lowThreshold;
  const smallest = ing.packages.length ? Math.min(...ing.packages.map((p) => p.qty)) : ing.baseUnit === 'ea' ? 1 : 0;
  return Math.max(smallest * 0.25, dailyRate * bufferDays);
}

export type AlertKind = 'expired' | 'thaw' | 'short' | 'out' | 'expiring' | 'old' | 'low';
const SEVERITY: Record<AlertKind, number> = { expired: 0, thaw: 1, short: 2, out: 3, expiring: 4, old: 5, low: 6 };

export interface Alert {
  id: string;
  kind: AlertKind;
  ingredientId: string;
  lotId?: string;
  title: string;
  detail: string;
}

export interface ItemForecast {
  onHand: number;
  rate: number;
  daysLeft?: number;
  runOutOn?: ISODate;
  threshold: number;
  status: 'out' | 'low' | 'ok';
}

export function forecastItem(
  ing: Ingredient,
  lots: StockLot[],
  txns: InventoryTxn[],
  loose: LooseStock | undefined,
  today: ISODate,
  now: number,
  bufferDays: number,
): ItemForecast {
  if (ing.trackMode === 'loose') {
    const level = loose?.level;
    return { onHand: 0, rate: 0, threshold: 0, status: level === 'out' ? 'out' : level === 'low' ? 'low' : 'ok' };
  }
  const have = onHand(lots, ing.id);
  const rate = usageRate(txns, ing.id, now);
  const threshold = effectiveThreshold(ing, rate, bufferDays);
  const daysLeft = rate > 0 ? have / rate : undefined;
  const runOutOn = daysLeft !== undefined ? addDaysISO(today, Math.floor(daysLeft)) : undefined;
  let status: ItemForecast['status'] = 'ok';
  if (negligible(have, ing.baseUnit)) status = 'out';
  else if (have < threshold || (daysLeft !== undefined && daysLeft < bufferDays)) status = 'low';
  return { onHand: have, rate, daysLeft, runOutOn, threshold, status };
}

export interface AlertInput {
  ingredients: Map<string, Ingredient>;
  recipes: Map<string, Recipe>;
  lots: StockLot[];
  loose: LooseStock[];
  txns: InventoryTxn[];
  meals: PlannedMeal[];
  today: ISODate;
  now: number;
  bufferDays: number;
  shoppingDay: number;
}

export function computeAlerts(input: AlertInput): Alert[] {
  const { ingredients, recipes, lots, loose, txns, meals, today, now, bufferDays } = input;
  const alerts: Alert[] = [];

  // Plan-aware shortages until the next shopping trip (at least the next 3 days).
  const nextShop = nextShoppingDay(today, input.shoppingDay);
  const horizonEnd = [addDaysISO(nextShop, -1), addDaysISO(today, 2)].sort().at(-1)!;
  const upcoming = meals.filter((m) => m.date >= today && m.date <= horizonEnd);
  const { demands } = buildDemands(upcoming, recipes, ingredients);
  const sim = simulate(lots, loose, demands, ingredients);
  const mealById = new Map(meals.map((m) => [m.id, m]));
  const shortIds = new Set<string>();
  for (const d of [...demands].sort((a, b) => a.date.localeCompare(b.date))) {
    const short = sim.shortfalls.get(d.id);
    const ing = ingredients.get(d.ingredientId);
    if (!short || !ing || shortIds.has(ing.id)) continue;
    shortIds.add(ing.id);
    const meal = mealById.get(d.mealId);
    const recipe = meal ? recipes.get(meal.recipeId) : undefined;
    alerts.push({
      id: `short:${ing.id}`,
      kind: 'short',
      ingredientId: ing.id,
      title: `Not enough ${ing.name.toLowerCase()}`,
      detail: `Needed for ${recipe?.title ?? 'a planned meal'} (${relativeDayLabel(d.date, today)})`,
    });
  }

  const looseById = new Map(loose.map((l) => [l.ingredientId, l]));
  const withLots = new Set(lots.map((l) => l.ingredientId));
  for (const ing of ingredients.values()) {
    if (shortIds.has(ing.id)) continue;
    if (ing.trackMode === 'loose') {
      const level = looseById.get(ing.id)?.level;
      if (!ing.keepStocked || !level || level === 'plenty') continue;
      alerts.push({
        id: `${level}:${ing.id}`,
        kind: level === 'out' ? 'out' : 'low',
        ingredientId: ing.id,
        title: level === 'out' ? `Out of ${ing.name.toLowerCase()}` : `Running low on ${ing.name.toLowerCase()}`,
        detail: 'Staple',
      });
      continue;
    }
    if (!ing.keepStocked && !withLots.has(ing.id)) continue;
    const f = forecastItem(ing, lots, txns, undefined, today, now, bufferDays);
    if (f.status === 'out' && ing.keepStocked) {
      alerts.push({ id: `out:${ing.id}`, kind: 'out', ingredientId: ing.id, title: `Out of ${ing.name.toLowerCase()}`, detail: 'Staple' });
    } else if (f.status === 'low') {
      alerts.push({
        id: `low:${ing.id}`,
        kind: 'low',
        ingredientId: ing.id,
        title: `Running low on ${ing.name.toLowerCase()}`,
        detail: f.daysLeft !== undefined ? `About ${Math.max(0, Math.round(f.daysLeft))} days left at your pace` : 'Below your usual amount',
      });
    }
  }

  for (const lot of lots) {
    if (!lot.expiresOn) continue;
    const ing = ingredients.get(lot.ingredientId);
    if (!ing) continue;
    const days = daysBetween(today, lot.expiresOn);
    if (days < 0) {
      alerts.push({ id: `expired:${lot.id}`, kind: 'expired', ingredientId: ing.id, lotId: lot.id, title: `${ing.name} may have expired`, detail: `Best by ${relativeDayLabel(lot.expiresOn, today)}` });
    } else if (days <= 2) {
      alerts.push({ id: `expiring:${lot.id}`, kind: 'expiring', ingredientId: ing.id, lotId: lot.id, title: `Use your ${ing.name.toLowerCase()} soon`, detail: days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}` });
    }
  }

  // Frozen food a meal in the next 2 days will use.
  const freshIn = { lots, loose, ingById: ingredients, meals, recipesById: recipes, today };
  for (const t of thawNeeds(freshIn)) {
    const recipe = recipes.get(t.recipeId);
    const cookingToday = t.date === today;
    alerts.push({
      id: `thaw:${t.lot.id}`,
      kind: 'thaw',
      ingredientId: t.ing.id,
      lotId: t.lot.id,
      title: cookingToday ? `Thaw the ${t.ing.name.toLowerCase()} now` : t.thawBy === today ? `Move the ${t.ing.name.toLowerCase()} to the fridge tonight` : `Thaw ${t.ing.name.toLowerCase()} ${relativeDayLabel(t.thawBy, today).toLowerCase()}`,
      detail: `For ${recipe?.title ?? 'a planned meal'} (${relativeDayLabel(t.date, today)})${cookingToday ? ' — use the cold-water method' : ''}`,
    });
  }

  // Leftover perishables that have been around a while and aren't part of any plan.
  for (const u of useUpCandidates(freshIn)) {
    if (u.reason !== 'old' || shortIds.has(u.ing.id)) continue;
    alerts.push({
      id: `old:${u.lot.id}`,
      kind: 'old',
      ingredientId: u.ing.id,
      lotId: u.lot.id,
      title: `Use up your ${u.ing.name.toLowerCase()}?`,
      detail: `Bought ${u.ageDays} days ago and no meal planned for it${u.ing.shelfLife.freezer ? ' — or freeze it' : ''}`,
    });
  }

  return alerts.sort((a, b) => SEVERITY[a.kind] - SEVERITY[b.kind]);
}
