// Seasonality: which produce is at its peak right now, and which recipes lean on it.
import { SEASONS } from '../data/seasons';
import { fromISODate } from './dates';
import type { ISODate, Recipe } from './types';

export const monthOf = (date: ISODate): number => fromISODate(date).getMonth() + 1;

/** Peak months for an ingredient, or undefined if it has no real season. */
export const seasonOf = (ingredientId: string): number[] | undefined => SEASONS[ingredientId];

export function inSeason(ingredientId: string, date: ISODate): boolean {
  return seasonOf(ingredientId)?.includes(monthOf(date)) ?? false;
}

/** Peak next month but not this one — worth waiting for. */
export function comingSoon(ingredientId: string, date: ISODate): boolean {
  const s = seasonOf(ingredientId);
  if (!s) return false;
  const m = monthOf(date);
  return !s.includes(m) && s.includes((m % 12) + 1);
}

/** A seasonal item the recipe calls for is out of its window — it will cost more and taste worse. */
export function outOfSeason(ingredientId: string, date: ISODate): boolean {
  return seasonOf(ingredientId) !== undefined && !inSeason(ingredientId, date);
}

export interface SeasonalRecipe {
  recipe: Recipe;
  /** Ingredient ids in the recipe that are peaking now. */
  peaking: string[];
  score: number;
}

/**
 * Recipes built around whatever is peaking this month. Ranked by how much of the dish is
 * seasonal rather than by a raw count, so a three-ingredient tomato salad beats a stew that
 * happens to contain one zucchini.
 */
export function seasonalPicks(input: {
  recipes: Recipe[];
  date: ISODate;
  limit?: number;
  /** Skip these (already planned, say). */
  exclude?: Set<string>;
}): SeasonalRecipe[] {
  const out: SeasonalRecipe[] = [];
  for (const r of input.recipes) {
    if (r.archived || input.exclude?.has(r.id)) continue;
    const peaking = r.ingredients.filter((ri) => !ri.optional && inSeason(ri.ingredientId, input.date)).map((ri) => ri.ingredientId);
    if (!peaking.length) continue;
    const share = peaking.length / Math.max(1, r.ingredients.length);
    out.push({ recipe: r, peaking: [...new Set(peaking)], score: peaking.length + share * 6 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, input.limit ?? 12);
}

/** Every seasonal ingredient peaking on a date, in catalog order. */
export function peakingNow(ingredientIds: Iterable<string>, date: ISODate): string[] {
  return [...ingredientIds].filter((id) => inSeason(id, date));
}
