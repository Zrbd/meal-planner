// Shopping list builder: planned meals + pantry → exactly what to buy for a date range.
import { addDaysISO } from './dates';
import { effectiveThreshold } from './forecast';
import { choosePackages, describePackages, type PackChoice } from './packages';
import { buildDemands, negligible, onHand, simulate } from './stock';
import { formatQty } from './units';
import type {
  AisleId, Ingredient, ISODate, LooseStock, PlannedMeal, Recipe, ShoppingState, StockLot, UnitSystem,
} from './types';

export interface ShoppingReason {
  kind: 'meal' | 'restock' | 'loose';
  mealId?: string;
  recipeId?: string;
  date?: ISODate;
  qty: number;
}

export type ShoppingSection = 'buy' | 'check' | 'skipped';

export interface ShoppingLine {
  key: string;
  ingredientId?: string;
  name: string;
  aisle: AisleId;
  need: number;
  buy: number;
  packages: PackChoice;
  leftover: number;
  reasons: ShoppingReason[];
  section: ShoppingSection;
  checked: boolean;
  manual: boolean;
  overridden: boolean;
  /** Perishable extra that would likely spoil before any planned meal uses it, and how to avoid that. */
  waste?: WasteHint;
}

export interface WasteHint {
  /** Amount likely to go bad (baseUnit). */
  qty: number;
  /** Use-by date if bought on the first day of the range. */
  useBy: ISODate;
  /** Exactly what the meals need (whole items for 'ea'). */
  exact: number;
  /** loose = buy just `exact` loose / at the counter; freeze = freeze the extra; plan = plan a meal for it. */
  fix: 'loose' | 'freeze' | 'plan';
}

const LOOSE_AISLES: string[] = ['produce', 'meat', 'seafood', 'deli'];

/** Would buying `buy` of a perishable leave extra that spoils before planned meals get to it? */
export function wasteHint(ing: Ingredient, buy: number, need: number, from: ISODate, laterUse: { date: ISODate; qty: number }[], leftoverStock: number): WasteHint | undefined {
  if (ing.trackMode !== 'exact' || ing.defaultLocation === 'freezer') return undefined;
  const shelf = ing.shelfLife[ing.defaultLocation];
  if (!shelf || shelf > 14) return undefined;
  const extra = buy - need;
  if (negligible(extra, ing.baseUnit) || extra < buy * 0.1) return undefined;
  const useBy = addDaysISO(from, shelf);
  const later = laterUse.filter((u) => u.date <= useBy).reduce((s, u) => s + u.qty, 0);
  const spoils = extra - Math.max(0, later - leftoverStock);
  if (negligible(spoils, ing.baseUnit) || spoils < buy * 0.1) return undefined;
  const exact = ing.baseUnit === 'ea' ? Math.max(1, Math.ceil(need - 0.05)) : need;
  const canBuyLoose = LOOSE_AISLES.includes(ing.aisle) && ing.baseUnit !== 'ml' && exact < buy - 1e-6;
  return { qty: spoils, useBy, exact, fix: canBuyLoose ? 'loose' : ing.shelfLife.freezer ? 'freeze' : 'plan' };
}

export interface ShoppingInput {
  from: ISODate;
  to: ISODate;
  today: ISODate;
  meals: PlannedMeal[];
  recipes: Map<string, Recipe>;
  ingredients: Map<string, Ingredient>;
  lots: StockLot[];
  loose: LooseStock[];
  state: ShoppingState[];
  aisleOrder: AisleId[];
  bufferDays: number;
  dailyRates?: Map<string, number>;
}

export interface ShoppingResult {
  lines: ShoppingLine[];
  mealIds: string[];
  errors: string[];
}

function buyFor(need: number, ing: Ingredient): PackChoice {
  if (!ing.packages.length && ing.baseUnit === 'ea') {
    return { items: [], total: Math.max(1, Math.ceil(need - 0.05)) };
  }
  return choosePackages(need, ing.packages);
}

export function buildShoppingList(input: ShoppingInput): ShoppingResult {
  const { from, to, today, recipes, ingredients } = input;
  const start = from < today ? from : today;
  const relevant = input.meals.filter((m) => m.date >= start && m.date <= to);
  const { demands, errors } = buildDemands(relevant, recipes, ingredients);
  const sim = simulate(input.lots, input.loose, demands, ingredients);
  const inRange = (d: ISODate) => d >= from && d <= to;
  const mealById = new Map(relevant.map((m) => [m.id, m]));
  const looseLevel = new Map(input.loose.map((l) => [l.ingredientId, l.level]));
  const stateByKey = new Map(input.state.map((s) => [s.key, s]));

  const need = new Map<string, number>();
  const reasons = new Map<string, ShoppingReason[]>();
  const looseUsed = new Map<string, ShoppingReason[]>();
  const addReason = (map: Map<string, ShoppingReason[]>, id: string, r: ShoppingReason) =>
    map.set(id, [...(map.get(id) ?? []), r]);

  for (const d of demands) {
    if (!inRange(d.date)) continue;
    const ing = ingredients.get(d.ingredientId);
    const meal = mealById.get(d.mealId)!;
    const reason: ShoppingReason = { kind: 'meal', mealId: meal.id, recipeId: meal.recipeId, date: d.date, qty: d.qty };
    if (ing?.alwaysOnHand) continue;
    if (ing?.trackMode === 'loose') {
      addReason(looseUsed, d.ingredientId, reason);
      continue;
    }
    const short = sim.shortfalls.get(d.id);
    if (!short) continue;
    need.set(d.ingredientId, (need.get(d.ingredientId) ?? 0) + short);
    addReason(reasons, d.ingredientId, { ...reason, qty: short });
  }

  // Restock staples that will be below their threshold after this range.
  for (const ing of ingredients.values()) {
    if (!ing.keepStocked) continue;
    if (ing.trackMode === 'loose') {
      const lvl = looseLevel.get(ing.id);
      if ((lvl === 'out' || lvl === 'low') && !looseUsed.has(ing.id)) {
        addReason(looseUsed, ing.id, { kind: 'restock', qty: 0 });
      }
      continue;
    }
    const remaining = onHand(sim.remaining, ing.id);
    const threshold = effectiveThreshold(ing, input.dailyRates?.get(ing.id) ?? 0, input.bufferDays);
    if (remaining < threshold && !need.has(ing.id)) {
      need.set(ing.id, threshold - remaining);
      addReason(reasons, ing.id, { kind: 'restock', qty: threshold - remaining });
    }
  }

  // Meals after the range that could still use up extra perishables before they spoil.
  const laterMeals = input.meals.filter((m) => m.date > to && m.date <= addDaysISO(to, 14));
  const laterByIng = new Map<string, { date: ISODate; qty: number }[]>();
  for (const d of buildDemands(laterMeals, recipes, ingredients).demands) {
    laterByIng.set(d.ingredientId, [...(laterByIng.get(d.ingredientId) ?? []), { date: d.date, qty: d.qty }]);
  }

  const lines: ShoppingLine[] = [];
  for (const [id, qty] of need) {
    const ing = ingredients.get(id);
    if (!ing || negligible(qty, ing.baseUnit)) continue;
    const st = stateByKey.get(id);
    const packages = buyFor(qty, ing);
    const buy = st?.qtyOverride ?? packages.total;
    const onlyRestock = (reasons.get(id) ?? []).every((r) => r.kind === 'restock');
    lines.push({
      key: id, ingredientId: id, name: ing.name, aisle: ing.aisle, need: qty, buy, packages,
      leftover: Math.max(0, buy - qty), reasons: reasons.get(id) ?? [],
      section: st?.haveIt ? 'skipped' : 'buy', checked: !!st?.checked, manual: false,
      overridden: st?.qtyOverride !== undefined,
      waste: onlyRestock ? undefined : wasteHint(ing, buy, qty, from, laterByIng.get(id) ?? [], onHand(sim.remaining, id)),
    });
  }

  for (const [id, rs] of looseUsed) {
    const ing = ingredients.get(id);
    if (!ing) continue;
    const lvl = looseLevel.get(id);
    if (lvl === 'plenty') continue;
    const st = stateByKey.get(id);
    const smallest = [...ing.packages].sort((a, b) => a.qty - b.qty)[0];
    const packages: PackChoice = smallest
      ? { items: [{ label: smallest.label, qty: smallest.qty, count: 1 }], total: smallest.qty }
      : { items: [], total: 0 };
    const section: ShoppingSection = st?.haveIt ? 'skipped' : lvl === 'out' || (lvl === 'low' && ing.keepStocked) ? 'buy' : 'check';
    lines.push({
      key: id, ingredientId: id, name: ing.name, aisle: ing.aisle, need: 0, buy: packages.total, packages,
      leftover: 0, reasons: rs.map((r) => ({ ...r, kind: r.kind === 'restock' ? 'restock' : 'loose' })),
      section, checked: !!st?.checked, manual: false, overridden: false,
    });
  }

  for (const st of input.state) {
    if (!st.manualName) continue;
    lines.push({
      key: st.key, name: st.manualName, aisle: 'other', need: 0, buy: 0, packages: { items: [], total: 0 },
      leftover: 0, reasons: [], section: 'buy', checked: st.checked, manual: true, overridden: false,
    });
  }

  const aisleIdx = (a: AisleId) => {
    const i = input.aisleOrder.indexOf(a);
    return i === -1 ? 999 : i;
  };
  lines.sort((a, b) => aisleIdx(a.aisle) - aisleIdx(b.aisle) || a.name.localeCompare(b.name));

  const mealIds = relevant.filter((m) => inRange(m.date) && m.status === 'planned').map((m) => m.id);
  return { lines, mealIds, errors };
}

/** Human-readable "what to buy" for a line. */
export function describeBuy(line: ShoppingLine, ing: Ingredient | undefined, system: UnitSystem): string {
  if (line.manual || !ing) return '';
  if (line.overridden) return formatQty(line.buy, ing, system);
  if (line.packages.items.length) return describePackages(line.packages);
  return formatQty(line.buy, ing, system);
}

export function shoppingListText(
  lines: ShoppingLine[],
  ingredients: Map<string, Ingredient>,
  system: UnitSystem,
  aisleLabel: (a: AisleId) => string,
): string {
  const out: string[] = [];
  let aisle: AisleId | null = null;
  for (const l of lines) {
    if (l.section !== 'buy' || l.checked) continue;
    if (l.aisle !== aisle) {
      aisle = l.aisle;
      out.push('', aisleLabel(aisle).toUpperCase());
    }
    const buy = describeBuy(l, l.ingredientId ? ingredients.get(l.ingredientId) : undefined, system);
    out.push(`☐ ${l.name}${buy ? ` — ${buy}` : ''}`);
  }
  return out.join('\n').trim();
}
