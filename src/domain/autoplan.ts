// Auto-plan: greedy HelloFresh-style meal picker that favors using what you have,
// rescuing expiring food, sharing perishables across meals, and variety.
import { availableByIngredient } from './coverage';
import { addDaysISO, isWeeknight } from './dates';
import { isFullMeal } from './dishes';
import { choosePackages } from './packages';
import { EPS, SLOT_ORDER, isUsableOn, lotsInUseOrder, negligible, recipeNeeds } from './stock';
import type { Ingredient, ISODate, LooseStock, PlannedMeal, Recipe, Settings, Slot, SmokerMode, StockLot } from './types';

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
  useUp: 5,
  pairs: 1.5,
};

/** Coverage counts real food, not the spice rack: how much of a meal you already have. */
export function pantryDepth(wHave: number): number {
  return Math.min(1, wHave / 8);
}

export interface PlanSlot {
  date: ISODate;
  slot: Slot;
}

export interface AutoPick extends PlanSlot {
  recipeId: string;
  score: number;
  reasons: string[];
  /** A side dish planned alongside the main in the same slot. */
  side?: boolean;
  /** The main this side was picked for. */
  sideOf?: string;
  /** Part of this meal is cooked in the smoker, so the user gets asked about it. */
  usesSmoker?: boolean;
}

export const usesSmoker = (r: Recipe) => !!r.tags?.includes('smoker');
const isSide = (r: Recipe) => r.role === 'side';

/** Smoker recipes are welcome, welcome on weekends only, or not at all. */
export function smokerAllowed(date: ISODate, mode: SmokerMode | undefined): boolean {
  const m = mode ?? 'weekends';
  if (m === 'any') return true;
  if (m === 'off') return false;
  return !isWeeknight(date);
}

export interface AutoPlanInput {
  slots: PlanSlot[];
  existing: PlannedMeal[];
  recipes: Recipe[];
  ingById: Map<string, Ingredient>;
  lots: StockLot[];
  loose: LooseStock[];
  recentCooks: { recipeId: string; at: number }[];
  settings: Pick<Settings, 'dietFilters' | 'dislikedIngredients' | 'weeknightMaxMin'> &
    Partial<Pick<Settings, 'pantryPull' | 'planSides' | 'smoker'>>;
  servings: number;
  today: ISODate;
  now: number;
  seed: number;
  avoid?: Map<string, string[]>; // `${date}:${slot}` -> recipeIds not to pick (for "swap")
  /** Ingredient ids the user asked to use up (old or leftover food). Strongly preferred until used. */
  useUp?: string[];
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
  ingById?: Map<string, Ingredient>,
): Recipe[] {
  let base = recipes.filter(
    (r) =>
      !r.archived &&
      !isSide(r) &&
      (!usesSmoker(r) || smokerAllowed(date, settings.smoker)) &&
      r.slots.includes(slot) &&
      settings.dietFilters.every((t) => r.diet.includes(t)) &&
      !r.ingredients.some((i) => !i.optional && settings.dislikedIngredients.includes(i.ingredientId)),
  );
  // Dinner is a real meal: an entrée (or hearty soup/salad) with protein, never just rice or green beans.
  if (slot === 'dinner' && ingById) {
    const full = base.filter((r) => isFullMeal(r, ingById));
    if (full.length) base = full;
  }
  if (slot !== 'dinner' || !isWeeknight(date) || !settings.weeknightMaxMin) return base;
  const quick = base.filter((r) => r.prepMin + r.cookMin <= settings.weeknightMaxMin);
  return quick.length ? quick : base;
}

/** A side dish for a main: the ones it is written to go with first, then something that fits. */
export function pickSide(
  main: Recipe,
  recipes: Recipe[],
  used: Set<string>,
  available: Map<string, number>,
  ingById: Map<string, Ingredient>,
  rng: () => number,
): Recipe | undefined {
  const sides = recipes.filter((r) => !r.archived && isSide(r) && !used.has(r.id));
  if (!sides.length) return undefined;
  const paired = new Set([...(main.pairsWith ?? []), ...sides.filter((s) => s.pairsWith?.includes(main.id)).map((s) => s.id)]);
  let best: { r: Recipe; score: number } | undefined;
  for (const r of sides) {
    let have = 0, tot = 0;
    for (const ri of r.ingredients) {
      const ing = ingById.get(ri.ingredientId);
      if (!ing || ing.trackMode === 'loose' || ing.alwaysOnHand) continue;
      tot += 1;
      if ((available.get(ing.id) ?? 0) > 0) have += 1;
    }
    const score =
      (paired.has(r.id) ? 6 : 0) +
      (r.cuisine === main.cuisine ? 2 : 0) +
      (tot ? have / tot : 0.5) * 2 -
      (r.prepMin + r.cookMin) / 60 +
      rng() * 0.5;
    if (!best || score > best.score) best = { r, score };
  }
  return best?.r;
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
    const eligible = eligibleRecipes(input.recipes, s.slot, s.date, input.settings, ingById).filter((r) => !avoid.has(r.id));
    let candidates = eligible.filter((r) => !used.has(r.id));
    if (!candidates.length) candidates = eligible;
    if (!candidates.length) continue;

    const available = availableByIngredient(simLots, s.date);
    const expiring = new Set(
      simLots
        .filter((l) => l.expiresOn && l.expiresOn >= s.date && l.expiresOn <= addDaysISO(s.date, 3))
        .map((l) => l.ingredientId),
    );
    // "Use it up" items stop counting once earlier picks have eaten through them.
    const useUp = new Set((input.useUp ?? []).filter((id) => (available.get(id) ?? 0) > EPS));
    const neighbors = placed.filter(
      (p) => p.slot === s.slot && (p.date === addDaysISO(s.date, -1) || p.date === addDaysISO(s.date, 1)),
    );

    let best: AutoPick | null = null;
    for (const r of candidates) {
      const { needs } = recipeNeeds(r, servings, ingById);
      let wTot = 0, wHave = 0, expUse = 0, perishTot = 0, perishShared = 0;
      const usesUp: string[] = [];
      for (const [id, qty] of needs) {
        const ing = ingById.get(id);
        if (!ing) continue;
        if (useUp.has(id)) usesUp.push(ing.name.toLowerCase());
        // Spices, oil and tap water are always around; counting them made three-ingredient
        // rice dishes look like the best-stocked meal in the book.
        if (ing.trackMode === 'loose' || ing.alwaysOnHand) {
          // A spice you have run out of still counts against the meal, just lightly.
          if (ing.trackMode === 'loose' && looseLevel.get(id) === 'out') wTot += 1;
          continue;
        }
        wTot += ing.valueWeight;
        wHave += ing.valueWeight * Math.min(1, (available.get(id) ?? 0) / (qty || 1));
        if (expiring.has(id)) expUse++;
        if (isPerishable(ing)) {
          perishTot++;
          if (bought.has(id)) perishShared++;
        }
      }
      const ratio = wTot ? wHave / wTot : 0;
      // How much of this meal is already in the kitchen has to clear the bar the user set,
      // and a meal you have two things for does not beat one you have six things for.
      const pull = input.settings.pantryPull ?? 0.35;
      const coverage = ratio <= pull ? 0 : ((ratio - pull) / (1 - pull)) * (0.4 + 0.6 * pantryDepth(wHave));
      const expScore = expiring.size ? Math.min(1, expUse / Math.min(3, expiring.size)) : 0;
      const overlap = perishTot ? perishShared / perishTot : 0;
      const last = lastCooked.get(r.id);
      const daysAgo = last !== undefined ? (input.now - last) / 86_400_000 : Infinity;
      const recency = daysAgo < 14 ? (14 - daysAgo) / 14 : 0;
      const sameProtein = r.protein && neighbors.some((n) => n.recipe.protein === r.protein) ? 1 : 0;
      const sameCuisine = neighbors.some((n) => n.recipe.cuisine === r.cuisine) ? 1 : 0;
      const W = PLAN_WEIGHTS;
      const useUpScore = useUp.size ? Math.min(1, usesUp.length / Math.min(2, useUp.size)) : 0;
      const score =
        W.useUp * useUpScore +
        W.coverage * coverage + W.expiring * expScore + W.overlap * overlap +
        W.favorite * (r.favorite ? 1 : 0) + W.rating * ((r.rating ?? 3) - 3) -
        W.recency * recency - W.sameProtein * sameProtein - W.sameCuisine * sameCuisine +
        W.jitter * rng();
      if (!best || score > best.score) {
        const reasons: string[] = [];
        if (usesUp.length) reasons.push(`Uses up your ${usesUp.slice(0, 2).join(' & ')}`);
        if (expScore > 0) reasons.push('Uses food expiring soon');
        if (ratio >= 0.6 && wTot > 0) reasons.push('You have most ingredients');
        if (overlap >= 0.3) reasons.push('Shares ingredients with other meals');
        if (r.favorite) reasons.push('Favorite');
        if (usesSmoker(r)) reasons.push('Cooked in the smoker');
        best = { ...s, recipeId: r.id, score, reasons, usesSmoker: usesSmoker(r) || undefined };
      }
    }
    if (!best) continue;
    const recipe = recipesById.get(best.recipeId)!;
    picks.push(best);
    used.add(recipe.id);
    placed.push({ date: s.date, slot: s.slot, recipe });
    consume(recipe, s.date);

    if (s.slot === 'dinner' && (input.settings.planSides ?? true)) {
      const side = pickSide(recipe, input.recipes, used, available, ingById, rng);
      if (side) {
        picks.push({
          ...s, recipeId: side.id, score: 0, side: true, sideOf: recipe.id,
          reasons: [`Goes with ${recipe.title}`], usesSmoker: usesSmoker(side) || undefined,
        });
        used.add(side.id);
        consume(side, s.date);
      }
    }
  }
  return picks;
}
