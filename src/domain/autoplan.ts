// Auto-plan: greedy HelloFresh-style meal picker that favors using what you have,
// rescuing expiring food, sharing perishables across meals, and variety.
import { availableByIngredient } from './coverage';
import { addDaysISO, isWeeknight } from './dates';
import { choosePackages } from './packages';
import { EPS, SLOT_ORDER, isUsableOn, lotsInUseOrder, negligible, recipeNeeds } from './stock';
import type { Ingredient, ISODate, LooseStock, PlannedMeal, Recipe, Settings, Slot, StockLot } from './types';

export const PLAN_WEIGHTS = {
  coverage: 3,
  expiring: 4,
  overlap: 2.5,
  favorite: 1.5,
  rating: 0.5,
  recency: 3,
  sameProtein: 2,
  sameCuisine: 1,
  jitter: 0.3,
};

export interface PlanSlot {
  date: ISODate;
  slot: Slot;
}

export interface AutoPick extends PlanSlot {
  recipeId: string;
  score: number;
  reasons: string[];
}

export interface AutoPlanInput {
  slots: PlanSlot[];
  existing: PlannedMeal[];
  recipes: Recipe[];
  ingById: Map<string, Ingredient>;
  lots: StockLot[];
  loose: LooseStock[];
  recentCooks: { recipeId: string; at: number }[];
  settings: Pick<Settings, 'dietFilters' | 'dislikedIngredients' | 'weeknightMaxMin'>;
  servings: number;
  today: ISODate;
  now: number;
  seed: number;
  avoid?: Map<string, string[]>; // `${date}:${slot}` -> recipeIds not to pick (for "swap")
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isPerishable = (ing: Ingredient) =>
  ing.trackMode === 'exact' && ing.defaultLocation === 'fridge' && (ing.shelfLife.fridge ?? 999) <= 10;

export function eligibleRecipes(
  recipes: Recipe[],
  slot: Slot,
  date: ISODate,
  settings: AutoPlanInput['settings'],
): Recipe[] {
  const base = recipes.filter(
    (r) =>
      !r.archived &&
      r.slots.includes(slot) &&
      settings.dietFilters.every((t) => r.diet.includes(t)) &&
      !r.ingredients.some((i) => !i.optional && settings.dislikedIngredients.includes(i.ingredientId)),
  );
  if (slot !== 'dinner' || !isWeeknight(date) || !settings.weeknightMaxMin) return base;
  const quick = base.filter((r) => r.prepMin + r.cookMin <= settings.weeknightMaxMin);
  return quick.length ? quick : base;
}

export function autoPlan(input: AutoPlanInput): AutoPick[] {
  const { ingById, servings } = input;
  const rng = mulberry32(input.seed);
  const recipesById = new Map(input.recipes.map((r) => [r.id, r]));
  const looseLevel = new Map(input.loose.map((l) => [l.ingredientId, l.level]));
  let simLots: StockLot[] = input.lots.map((l) => ({ ...l }));
  const bought = new Set<string>();
  const used = new Set<string>();
  const placed: { date: ISODate; slot: Slot; recipe: Recipe }[] = [];
  const lastCooked = new Map<string, number>();
  for (const c of input.recentCooks) lastCooked.set(c.recipeId, Math.max(lastCooked.get(c.recipeId) ?? 0, c.at));

  const consume = (recipe: Recipe, date: ISODate) => {
    const { needs } = recipeNeeds(recipe, servings, ingById);
    for (const [id, qty] of needs) {
      const ing = ingById.get(id);
      if (!ing || ing.trackMode === 'loose') continue;
      let need = qty;
      for (const lot of lotsInUseOrder(simLots.filter((l) => l.ingredientId === id))) {
        if (!isUsableOn(lot, date) || lot.qty <= EPS) continue;
        const take = Math.min(lot.qty, need);
        lot.qty -= take;
        need -= take;
        if (need <= EPS) break;
      }
      if (negligible(need, ing.baseUnit, qty)) continue;
      if (isPerishable(ing)) bought.add(id);
      const leftover = choosePackages(need, ing.packages).total - need;
      if (leftover > EPS) {
        const shelf = ing.shelfLife[ing.defaultLocation];
        simLots.push({
          id: `sim:${id}:${date}:${placed.length}`, ingredientId: id, qty: leftover,
          location: ing.defaultLocation, addedAt: input.now, expiresOn: shelf ? addDaysISO(date, shelf) : undefined,
        });
      }
    }
    simLots = simLots.filter((l) => l.qty > EPS);
  };

  const existing = input.existing
    .filter((m) => m.status !== 'skipped')
    .sort((a, b) => a.date.localeCompare(b.date) || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  for (const m of existing) {
    const r = recipesById.get(m.recipeId);
    if (!r) continue;
    used.add(r.id);
    placed.push({ date: m.date, slot: m.slot, recipe: r });
    if (m.status === 'planned' && !m.leftoverOf) consume(r, m.date);
  }

  const picks: AutoPick[] = [];
  const slots = [...input.slots].sort((a, b) => a.date.localeCompare(b.date) || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);

  for (const s of slots) {
    const avoid = new Set(input.avoid?.get(`${s.date}:${s.slot}`) ?? []);
    const eligible = eligibleRecipes(input.recipes, s.slot, s.date, input.settings).filter((r) => !avoid.has(r.id));
    let candidates = eligible.filter((r) => !used.has(r.id));
    if (!candidates.length) candidates = eligible;
    if (!candidates.length) continue;

    const available = availableByIngredient(simLots, s.date);
    const expiring = new Set(
      simLots
        .filter((l) => l.expiresOn && l.expiresOn >= s.date && l.expiresOn <= addDaysISO(s.date, 3))
        .map((l) => l.ingredientId),
    );
    const neighbors = placed.filter(
      (p) => p.slot === s.slot && (p.date === addDaysISO(s.date, -1) || p.date === addDaysISO(s.date, 1)),
    );

    let best: AutoPick | null = null;
    for (const r of candidates) {
      const { needs } = recipeNeeds(r, servings, ingById);
      let wTot = 0, wHave = 0, expUse = 0, perishTot = 0, perishShared = 0;
      for (const [id, qty] of needs) {
        const ing = ingById.get(id);
        if (!ing) continue;
        wTot += ing.valueWeight;
        if (ing.trackMode === 'loose') {
          if (looseLevel.get(id) !== 'out') wHave += ing.valueWeight;
          continue;
        }
        wHave += ing.valueWeight * Math.min(1, (available.get(id) ?? 0) / (qty || 1));
        if (expiring.has(id)) expUse++;
        if (isPerishable(ing)) {
          perishTot++;
          if (bought.has(id)) perishShared++;
        }
      }
      const coverage = wTot ? wHave / wTot : 0;
      const expScore = expiring.size ? Math.min(1, expUse / Math.min(3, expiring.size)) : 0;
      const overlap = perishTot ? perishShared / perishTot : 0;
      const last = lastCooked.get(r.id);
      const daysAgo = last !== undefined ? (input.now - last) / 86_400_000 : Infinity;
      const recency = daysAgo < 14 ? (14 - daysAgo) / 14 : 0;
      const sameProtein = r.protein && neighbors.some((n) => n.recipe.protein === r.protein) ? 1 : 0;
      const sameCuisine = neighbors.some((n) => n.recipe.cuisine === r.cuisine) ? 1 : 0;
      const W = PLAN_WEIGHTS;
      const score =
        W.coverage * coverage + W.expiring * expScore + W.overlap * overlap +
        W.favorite * (r.favorite ? 1 : 0) + W.rating * ((r.rating ?? 3) - 3) -
        W.recency * recency - W.sameProtein * sameProtein - W.sameCuisine * sameCuisine +
        W.jitter * rng();
      if (!best || score > best.score) {
        const reasons: string[] = [];
        if (expScore > 0) reasons.push('Uses food expiring soon');
        if (coverage >= 0.6) reasons.push('You have most ingredients');
        if (overlap >= 0.3) reasons.push('Shares ingredients with other meals');
        if (r.favorite) reasons.push('Favorite');
        best = { ...s, recipeId: r.id, score, reasons };
      }
    }
    if (!best) continue;
    const recipe = recipesById.get(best.recipeId)!;
    picks.push(best);
    used.add(recipe.id);
    placed.push({ date: s.date, slot: s.slot, recipe });
    consume(recipe, s.date);
  }
  return picks;
}
