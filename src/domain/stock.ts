// ★ Core primitive: allocate pantry lots to meals in date order.
// Used by shopping, cooking, forecasts, "what can I make", and auto-plan.
import { toBase } from './units';
import type { BaseUnit, Ingredient, ISODate, LooseStock, PlannedMeal, Recipe, Slot, StockLot } from './types';

export const EPS = 1e-6;
export const round3 = (n: number) => Math.round(n * 1000) / 1000;
export const SLOT_ORDER: Record<Slot, number> = { breakfast: 0, lunch: 1, dinner: 2 };

/** Is a leftover amount small enough to ignore? */
export function negligible(qty: number, baseUnit: BaseUnit, relativeTo = 0): boolean {
  const abs = baseUnit === 'ea' ? 0.05 : 0.5;
  return qty <= Math.max(abs, relativeTo * 0.03);
}

export interface Demand {
  id: string;
  mealId: string;
  date: ISODate;
  slotOrder: number;
  ingredientId: string;
  qty: number; // baseUnit
}

export interface Allocation {
  lotId: string;
  qty: number;
}

export interface SimResult {
  allocations: Map<string, Allocation[]>;
  shortfalls: Map<string, number>; // demandId -> qty short
  remaining: StockLot[];
}

export const lotsInUseOrder = (lots: StockLot[]) =>
  [...lots].sort(
    (a, b) =>
      (a.expiresOn ?? '9999-12-31').localeCompare(b.expiresOn ?? '9999-12-31') || a.addedAt - b.addedAt,
  );

export const isUsableOn = (lot: StockLot, date: ISODate) => !lot.expiresOn || lot.expiresOn >= date;

export function simulate(
  lots: StockLot[],
  loose: LooseStock[],
  demands: Demand[],
  ingById: Map<string, Ingredient>,
): SimResult {
  const remaining = new Map(lots.map((l) => [l.id, { ...l }]));
  const byIng = new Map<string, StockLot[]>();
  for (const lot of lotsInUseOrder([...remaining.values()])) {
    const arr = byIng.get(lot.ingredientId) ?? [];
    arr.push(lot);
    byIng.set(lot.ingredientId, arr);
  }
  const looseLevel = new Map(loose.map((l) => [l.ingredientId, l.level]));
  const allocations = new Map<string, Allocation[]>();
  const shortfalls = new Map<string, number>();

  const ordered = [...demands].sort((a, b) => a.date.localeCompare(b.date) || a.slotOrder - b.slotOrder);
  for (const d of ordered) {
    const ing = ingById.get(d.ingredientId);
    if (!ing) {
      shortfalls.set(d.id, d.qty);
      continue;
    }
    if (ing.trackMode === 'loose') {
      allocations.set(d.id, []);
      if (looseLevel.get(ing.id) === 'out') shortfalls.set(d.id, d.qty);
      continue;
    }
    let need = d.qty;
    const alloc: Allocation[] = [];
    for (const lot of byIng.get(ing.id) ?? []) {
      if (lot.qty <= EPS || !isUsableOn(lot, d.date)) continue;
      const take = Math.min(lot.qty, need);
      lot.qty -= take;
      need -= take;
      alloc.push({ lotId: lot.id, qty: take });
      if (need <= EPS) break;
    }
    allocations.set(d.id, alloc);
    if (!negligible(need, ing.baseUnit, d.qty)) shortfalls.set(d.id, round3(need));
  }

  return { allocations, shortfalls, remaining: [...remaining.values()].filter((l) => l.qty > EPS) };
}

/** Plan an actual deduction (cooking / "used some"): FIFO by expiry, expired lots included. */
export function planDeduction(lots: StockLot[], ingredientId: string, qty: number) {
  const takes: { lot: StockLot; take: number }[] = [];
  let need = qty;
  for (const lot of lotsInUseOrder(lots.filter((l) => l.ingredientId === ingredientId))) {
    if (need <= EPS) break;
    const take = Math.min(lot.qty, need);
    if (take <= EPS) continue;
    takes.push({ lot, take });
    need -= take;
  }
  return { takes, missing: need > EPS ? round3(need) : 0 };
}

export function onHand(lots: StockLot[], ingredientId: string): number {
  return lots.reduce((s, l) => (l.ingredientId === ingredientId ? s + l.qty : s), 0);
}

export interface NeedsResult {
  needs: Map<string, number>;
  errors: string[];
}

/** Base-unit needs of a recipe at a given serving count (optional ingredients excluded). */
export function recipeNeeds(
  recipe: Recipe,
  servings: number,
  ingById: Map<string, Ingredient>,
  includeOptional = false,
): NeedsResult {
  const scale = servings / (recipe.baseServings || 1);
  const needs = new Map<string, number>();
  const errors: string[] = [];
  for (const ri of recipe.ingredients) {
    if (ri.optional && !includeOptional) continue;
    const ing = ingById.get(ri.ingredientId);
    if (!ing) {
      errors.push(`Unknown ingredient ${ri.ingredientId} in ${recipe.title}`);
      continue;
    }
    try {
      const base = toBase(ri.qty * scale, ri.unit, ing);
      needs.set(ing.id, (needs.get(ing.id) ?? 0) + base);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  return { needs, errors };
}

/** Turn planned meals into demands (cooked/skipped and leftover meals need nothing). */
export function buildDemands(
  meals: PlannedMeal[],
  recipesById: Map<string, Recipe>,
  ingById: Map<string, Ingredient>,
): { demands: Demand[]; errors: string[] } {
  const demands: Demand[] = [];
  const errors: string[] = [];
  for (const m of meals) {
    if (m.status !== 'planned' || m.leftoverOf) continue;
    const recipe = recipesById.get(m.recipeId);
    if (!recipe) continue;
    const r = recipeNeeds(recipe, m.servings, ingById);
    errors.push(...r.errors);
    for (const [ingredientId, qty] of r.needs) {
      demands.push({
        id: `${m.id}:${ingredientId}`,
        mealId: m.id,
        date: m.date,
        slotOrder: SLOT_ORDER[m.slot],
        ingredientId,
        qty,
      });
    }
  }
  return { demands, errors };
}
