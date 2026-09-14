// Batch prep checklist: every cut the week's meals need (sliced chicken, diced onion…), grouped by ingredient,
// with where each portion should go — fridge if it keeps until that meal, otherwise freezer (thaw the night before)
// or leave it for the day of cooking.
import { categoryOf } from './categories';
import { addDaysISO, daysBetween } from './dates';
import { SLOT_ORDER } from './stock';
import type { Ingredient, ISODate, PlannedMeal, Recipe, Slot } from './types';
import { toBase } from './units';

const CUT = /\b(chopped|diced|minced|sliced|cubed|cut|shredded|grated|julienned|peeled|trimmed|halved|quartered|spiralized|zested|crushed|torn|pounded|butterflied|smashed|matchsticks|wedges|florets|chunks|strips)\b/i;
/** Prep that has to happen at cook time or isn't a knife job. */
const NOT_AHEAD = /\b(cooked|leftover|roasted|toasted|drained|rinsed|thawed|softened|melted|room temperature|to serve|for serving|garnish)\b/i;

/** Days that go brown fast once cut. */
const DAY_OF = new Set(['avocado', 'apple', 'banana', 'pear', 'basil']);

/** How many days an ingredient keeps in the fridge once cut. 0 = cut it on the day. */
export function cutLife(ing: Ingredient): number {
  if (DAY_OF.has(ing.id)) return 0;
  if (/potato/.test(ing.id)) return 1; // covered in water
  switch (categoryOf(ing)) {
    case 'meat': return 2;
    case 'seafood': return 1;
    case 'vegetables': return 4;
    case 'fruit': return 2;
    case 'herbs': return 1;
    case 'cheese': return 7;
    case 'bread': return 1;
    case 'nuts': return 14;
    default: return 3;
  }
}

export type PrepStorage = 'fridge' | 'freezer' | 'day-of';

export interface CutTask {
  /** Stable per planned meal + recipe line, for check-off. */
  id: string;
  ingredientId: string;
  cut: string;
  qty: number; // baseUnit, 0 if unknown
  recipeId: string;
  mealId: string;
  date: ISODate;
  slot: Slot;
  storage: PrepStorage;
  /** Move from freezer to fridge on this date (evening). */
  thawOn?: ISODate;
}

export interface CutGroup {
  ingredientId: string;
  total: number;
  tasks: CutTask[];
}

export function isCut(prep: string | undefined): boolean {
  return !!prep && CUT.test(prep) && !NOT_AHEAD.test(prep);
}

/** Cuts for planned meals from `from` (the prep day) through `to`, grouped by ingredient. */
export function weekPrep(input: {
  meals: PlannedMeal[];
  recipesById: Map<string, Recipe>;
  ingById: Map<string, Ingredient>;
  from: ISODate;
  to: ISODate;
}): CutGroup[] {
  const groups = new Map<string, CutGroup>();
  const meals = input.meals
    .filter((m) => m.status === 'planned' && !m.leftoverOf && m.date >= input.from && m.date <= input.to)
    .sort((a, b) => a.date.localeCompare(b.date) || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  for (const m of meals) {
    const recipe = input.recipesById.get(m.recipeId);
    if (!recipe) continue;
    const scale = m.servings / (recipe.baseServings || 1);
    recipe.ingredients.forEach((ri, idx) => {
      const ing = input.ingById.get(ri.ingredientId);
      if (!ing || ing.trackMode === 'loose' || ing.alwaysOnHand || !isCut(ri.prep)) return;
      let qty = 0;
      try {
        qty = toBase(ri.qty * scale, ri.unit, ing);
      } catch {
        qty = 0;
      }
      const days = daysBetween(input.from, m.date);
      const life = cutLife(ing);
      const storage: PrepStorage = life === 0 || days === 0 && life === 0 ? 'day-of' : days <= life ? 'fridge' : ing.shelfLife.freezer ? 'freezer' : 'day-of';
      const task: CutTask = {
        id: `${m.id}:${idx}`, ingredientId: ing.id, cut: ri.prep!, qty, recipeId: recipe.id, mealId: m.id, date: m.date, slot: m.slot, storage,
        ...(storage === 'freezer' ? { thawOn: addDaysISO(m.date, -1) } : {}),
      };
      const g = groups.get(ing.id) ?? { ingredientId: ing.id, total: 0, tasks: [] };
      g.total += qty;
      g.tasks.push(task);
      groups.set(ing.id, g);
    });
  }
  const catRank = (id: string) => {
    const c = categoryOf(input.ingById.get(id)!);
    return c === 'meat' ? 0 : c === 'seafood' ? 1 : c === 'vegetables' ? 2 : 3;
  };
  return [...groups.values()].sort(
    (a, b) => catRank(a.ingredientId) - catRank(b.ingredientId) || input.ingById.get(a.ingredientId)!.name.localeCompare(input.ingById.get(b.ingredientId)!.name),
  );
}
