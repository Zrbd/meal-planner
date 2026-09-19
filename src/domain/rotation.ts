// Rotation: recipes you liked once and then quietly stopped making.
import type { CookLog, ISODate, PlannedMeal, Recipe } from './types';
import { daysBetween, toISODate } from './dates';

/** Most recent cook time per recipe. */
export function lastCooked(cookLogs: CookLog[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cookLogs) if ((m.get(c.recipeId) ?? 0) < c.at) m.set(c.recipeId, c.at);
  return m;
}

export interface StaleRecipe {
  recipe: Recipe;
  /** Days since it was last cooked, or undefined if never. */
  daysAgo?: number;
  cooks: number;
  score: number;
}

/**
 * Recipes worth bringing back: cooked or rated before, not made in a while,
 * and not already on the plan. Favorites and high ratings float to the top.
 */
export function staleFavorites(input: {
  recipes: Recipe[];
  cookLogs: CookLog[];
  meals: PlannedMeal[];
  today: ISODate;
  now: number;
  /** Nothing counts as "stale" before this many days. */
  minDays?: number;
  limit?: number;
}): StaleRecipe[] {
  const minDays = input.minDays ?? 30;
  const last = lastCooked(input.cookLogs);
  const counts = new Map<string, number>();
  for (const c of input.cookLogs) counts.set(c.recipeId, (counts.get(c.recipeId) ?? 0) + 1);
  const planned = new Set(input.meals.filter((m) => m.date >= input.today && m.status !== 'skipped').map((m) => m.recipeId));

  const out: StaleRecipe[] = [];
  for (const r of input.recipes) {
    if (r.archived || r.role === 'side' || planned.has(r.id)) continue;
    const at = last.get(r.id);
    const cooks = counts.get(r.id) ?? 0;
    // Only nudge about things you have shown some interest in.
    const liked = r.favorite || (r.rating ?? 0) >= 4 || cooks > 0;
    if (!liked) continue;
    const daysAgo = at === undefined ? undefined : daysBetween(toISODate(new Date(at)), input.today);
    if (daysAgo !== undefined && daysAgo < minDays) continue;
    const score =
      (daysAgo ?? 365) / 30 + cooks * 0.5 + (r.favorite ? 2 : 0) + ((r.rating ?? 0) >= 4 ? 1.5 : 0);
    out.push({ recipe: r, daysAgo, cooks, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, input.limit ?? 12);
}
