// Freshness: food that's been sitting around (use it up?) and frozen food that needs thawing for upcoming meals.
import { addDaysISO, daysBetween, toISODate } from './dates';
import { buildDemands, negligible, simulate } from './stock';
import type { Ingredient, ISODate, LooseStock, PlannedMeal, Recipe, Slot, StockLot } from './types';

export const addedOn = (lot: StockLot): ISODate => toISODate(new Date(lot.addedAt));

export interface UseUpItem {
  lot: StockLot;
  ing: Ingredient;
  /** Amount not already spoken for by planned meals (baseUnit). */
  spare: number;
  ageDays: number;
  daysLeft?: number;
  reason: 'expiring' | 'old';
}

/** Is this lot old for its kind? Half its shelf life gone, or a week for anything that keeps under a month. */
export function isOld(lot: StockLot, ing: Ingredient, today: ISODate): boolean {
  if (lot.location === 'freezer') return false;
  const shelf = ing.shelfLife[lot.location];
  if (!shelf || shelf > 30) return false;
  const age = daysBetween(addedOn(lot), today);
  return age >= Math.max(3, Math.min(7, Math.ceil(shelf / 2)));
}

/**
 * Perishables worth planning meals around: expiring within `soonDays` or getting old,
 * counting only what planned meals won't already use.
 */
export function useUpCandidates(input: {
  lots: StockLot[];
  loose: LooseStock[];
  ingById: Map<string, Ingredient>;
  meals: PlannedMeal[];
  recipesById: Map<string, Recipe>;
  today: ISODate;
  soonDays?: number;
}): UseUpItem[] {
  const { ingById, today } = input;
  const soon = input.soonDays ?? 3;
  const upcoming = input.meals.filter((m) => m.date >= today);
  const { demands } = buildDemands(upcoming, input.recipesById, ingById);
  const { remaining } = simulate(input.lots, input.loose, demands, ingById);
  const original = new Map(input.lots.map((l) => [l.id, l]));
  const out: UseUpItem[] = [];
  for (const rest of remaining) {
    const lot = original.get(rest.id);
    const ing = ingById.get(rest.ingredientId);
    if (!lot || !ing || ing.trackMode !== 'exact' || ing.alwaysOnHand || lot.location === 'freezer') continue;
    const smallest = ing.packages.length ? Math.min(...ing.packages.map((p) => p.qty)) : 0;
    if (negligible(rest.qty, ing.baseUnit, smallest * 0.5)) continue;
    const daysLeft = lot.expiresOn ? daysBetween(today, lot.expiresOn) : undefined;
    if (daysLeft !== undefined && daysLeft < 0) continue; // expired: that's a toss-it alert, not a plan
    const expiring = daysLeft !== undefined && daysLeft <= soon;
    if (!expiring && !isOld(lot, ing, today)) continue;
    out.push({
      lot, ing, spare: rest.qty, ageDays: daysBetween(addedOn(lot), today), daysLeft,
      reason: expiring ? 'expiring' : 'old',
    });
  }
  return out.sort((a, b) => (a.daysLeft ?? 99) - (b.daysLeft ?? 99) || b.ageDays - a.ageDays);
}

const hasTip = (ing: Ingredient) => !ing.alwaysOnHand && !!(ing.storageTip || ing.thawTip);

/** A recipe's ingredients that come with keep-it-fresh or thawing advice. */
export function tipIngredients(recipe: Recipe, ingById: Map<string, Ingredient>): Ingredient[] {
  const out = new Map<string, Ingredient>();
  for (const ri of recipe.ingredients) {
    const ing = ingById.get(ri.ingredientId);
    if (ing && hasTip(ing)) out.set(ing.id, ing);
  }
  return [...out.values()];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Attach each tip to the first step that mentions the ingredient, so the hint shows up while you're using it. */
export function tipsByStep(recipe: Recipe, ingById: Map<string, Ingredient>): Map<number, Ingredient[]> {
  const out = new Map<number, Ingredient[]>();
  for (const ing of tipIngredients(recipe, ingById)) {
    const terms = [ing.name, ...ing.aliases].map((t) => t.toLowerCase().trim()).filter((t) => t.length > 2);
    const re = new RegExp(`\\b(?:${terms.map(escapeRe).join('|')})(?:s|es)?\\b`, 'i');
    const idx = recipe.steps.findIndex((s) => re.test(s));
    if (idx < 0) continue;
    out.set(idx, [...(out.get(idx) ?? []), ing]);
  }
  return out;
}

export interface ThawItem {
  lot: StockLot;
  ing: Ingredient;
  qty: number;
  mealId: string;
  recipeId: string;
  date: ISODate;
  slot: Slot;
  /** Move to the fridge by this day (night before the meal). */
  thawBy: ISODate;
}

/** Frozen lots that planned meals in the next `horizonDays` will draw from. */
export function thawNeeds(input: {
  lots: StockLot[];
  loose: LooseStock[];
  ingById: Map<string, Ingredient>;
  meals: PlannedMeal[];
  recipesById: Map<string, Recipe>;
  today: ISODate;
  horizonDays?: number;
}): ThawItem[] {
  const { today, ingById } = input;
  const end = addDaysISO(today, input.horizonDays ?? 2);
  const upcoming = input.meals.filter((m) => m.date >= today && m.date <= end);
  const { demands } = buildDemands(upcoming, input.recipesById, ingById);
  const sim = simulate(input.lots, input.loose, demands, ingById);
  const lotById = new Map(input.lots.map((l) => [l.id, l]));
  const mealById = new Map(input.meals.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const out: ThawItem[] = [];
  for (const d of [...demands].sort((a, b) => a.date.localeCompare(b.date) || a.slotOrder - b.slotOrder)) {
    for (const a of sim.allocations.get(d.id) ?? []) {
      const lot = lotById.get(a.lotId);
      const ing = ingById.get(d.ingredientId);
      const meal = mealById.get(d.mealId);
      if (!lot || !ing || !meal || lot.location !== 'freezer' || seen.has(lot.id)) continue;
      seen.add(lot.id);
      out.push({
        lot, ing, qty: a.qty, mealId: meal.id, recipeId: meal.recipeId, date: meal.date, slot: meal.slot,
        thawBy: addDaysISO(meal.date, -1) < today ? today : addDaysISO(meal.date, -1),
      });
    }
  }
  return out;
}
