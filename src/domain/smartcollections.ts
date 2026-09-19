// Collections that fill themselves in. The manual ones in `collections.ts` are lists you curate;
// these are questions you ask the recipe box — "what can I cook tonight with what's here?" —
// re-answered every time you open the screen, so they never go stale.
import { inSeason } from './seasons';
import type { ISODate, Recipe } from './types';

export interface SmartContext {
  date: ISODate;
  /** Epoch ms of the last time each recipe was cooked. */
  lastCookedAt: Map<string, number>;
  /** 0–1 pantry coverage, already computed for the current stock. */
  coverage: Map<string, number>;
  weeknightMaxMin: number;
  now: number;
}

export interface SmartCollection {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  match: (r: Recipe, ctx: SmartContext) => boolean;
  /** Higher sorts first inside the collection; ties fall back to title. */
  rank?: (r: Recipe, ctx: SmartContext) => number;
}

const DAY = 86_400_000;
const time = (r: Recipe) => r.prepMin + r.cookMin;

export const SMART_COLLECTIONS: SmartCollection[] = [
  {
    id: 'smart:tonight',
    name: 'Cook tonight',
    emoji: '🍽️',
    blurb: 'Fits a weeknight and the pantry already covers nearly all of it.',
    match: (r, c) => time(r) <= c.weeknightMaxMin && (c.coverage.get(r.id) ?? 0) >= 0.9,
    rank: (r, c) => (c.coverage.get(r.id) ?? 0) * 100 - time(r) / 10,
  },
  {
    id: 'smart:quick',
    name: 'Under 30 minutes',
    emoji: '⚡️',
    blurb: 'Start to table in half an hour.',
    match: (r) => time(r) <= 30,
    rank: (r) => -time(r),
  },
  {
    id: 'smart:favorites',
    name: 'Favorites',
    emoji: '⭐️',
    blurb: 'Everything you starred, plus anything rated four or five.',
    match: (r) => r.favorite || (r.rating ?? 0) >= 4,
    rank: (r) => (r.rating ?? 0) + (r.favorite ? 1 : 0),
  },
  {
    id: 'smart:neglected',
    name: 'Been a while',
    emoji: '🕰️',
    blurb: 'Cooked at least once, but not in the last two months.',
    match: (r, c) => {
      const last = c.lastCookedAt.get(r.id);
      return last !== undefined && c.now - last > 60 * DAY;
    },
    rank: (r, c) => -(c.lastCookedAt.get(r.id) ?? 0),
  },
  {
    id: 'smart:untried',
    name: 'Never cooked',
    emoji: '🆕',
    blurb: "Recipes you've saved and never actually made.",
    match: (r, c) => !c.lastCookedAt.has(r.id),
    rank: (r) => r.updatedAt,
  },
  {
    id: 'smart:seasonal',
    name: 'In season now',
    emoji: '🌿',
    blurb: 'Built around produce at its peak this month.',
    match: (r, c) => r.ingredients.some((ri) => !ri.optional && inSeason(ri.ingredientId, c.date)),
    rank: (r, c) => r.ingredients.filter((ri) => inSeason(ri.ingredientId, c.date)).length,
  },
  {
    id: 'smart:batch',
    name: 'Makes great leftovers',
    emoji: '🥡',
    blurb: 'Stews, braises, soups and bakes — things that are better on day two.',
    match: (r) =>
      (r.tags ?? []).some((t) => ['make-ahead', 'freezer', 'batch'].includes(t)) ||
      (r.role !== 'side' && r.role !== 'dessert' && r.cookMin >= 45),
    rank: (r) => r.cookMin,
  },
  {
    id: 'smart:project',
    name: 'Weekend projects',
    emoji: '🔥',
    blurb: 'Long cooks for a day you are actually home.',
    match: (r) => time(r) > 120 || (r.tags ?? []).includes('smoker'),
    rank: (r) => time(r),
  },
];

export const smartById = (id: string): SmartCollection | undefined => SMART_COLLECTIONS.find((c) => c.id === id);

/** Recipes in a smart collection, best first. Archived recipes never show up. */
export function smartMembers(collection: SmartCollection, recipes: Recipe[], ctx: SmartContext): Recipe[] {
  const rank = collection.rank ?? (() => 0);
  return recipes
    .filter((r) => !r.archived && collection.match(r, ctx))
    .sort((a, b) => rank(b, ctx) - rank(a, ctx) || a.title.localeCompare(b.title));
}

/** Counts for every smart collection in one pass, for the index screen. */
export function smartCounts(recipes: Recipe[], ctx: SmartContext): Map<string, number> {
  const live = recipes.filter((r) => !r.archived);
  return new Map(SMART_COLLECTIONS.map((c) => [c.id, live.filter((r) => c.match(r, ctx)).length]));
}
