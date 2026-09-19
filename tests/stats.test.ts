import { describe, expect, it } from 'vitest';
import { budgetStatus } from '../src/domain/budget';
import { collectionsOf, parseCollections, pruneCollections, toggleMembership } from '../src/domain/collections';
import { entriesFor, journalRating, parseJournal } from '../src/domain/journal';
import { deadStock, pantryValue, recipesUsing } from '../src/domain/pantryvalue';
import { priceBook, priceHistory } from '../src/domain/prices';
import { recipeToText, planToText } from '../src/domain/recipetext';
import { lastCooked, staleFavorites } from '../src/domain/rotation';
import { kitchenStats, streaks } from '../src/domain/stats';
import type { CookLog, InventoryTxn, Trip } from '../src/domain/types';
import { ing, ingById, lot, meal, recipesById, TEST_RECIPES } from './helpers';

const DAY = 86_400_000;
const TODAY = '2026-03-15';
// Local noon on TODAY, so day arithmetic never trips over a timezone edge.
const NOW = new Date(2026, 2, 15, 12).getTime();
const at = (daysAgo: number) => NOW - daysAgo * DAY;

const log = (recipeId: string, daysAgo: number): CookLog =>
  ({ id: `c${recipeId}${daysAgo}`, recipeId, at: at(daysAgo), servings: 4, used: [] }) as CookLog;

const trip = (daysAgo: number, ...prices: number[]): Trip => ({
  id: `t${daysAgo}`,
  finishedAt: at(daysAgo),
  lines: prices.map((price, i) => ({ ingredientId: 'ground-turkey', name: 'turkey', qty: 454, price, key: `k${i}` })),
}) as unknown as Trip;

const waste = (ingredientId: string, qty: number, daysAgo: number): InventoryTxn =>
  ({ id: `w${ingredientId}${daysAgo}`, ingredientId, delta: -qty, at: at(daysAgo), reason: 'waste' }) as InventoryTxn;

describe('streaks', () => {
  it('counts consecutive days ending today', () => {
    expect(streaks(['2026-03-13', '2026-03-14', '2026-03-15'], TODAY)).toEqual({ current: 3, best: 3 });
  });

  it('keeps yesterday-ending streaks alive but drops older ones', () => {
    expect(streaks(['2026-03-13', '2026-03-14'], TODAY).current).toBe(2);
    expect(streaks(['2026-03-11', '2026-03-12'], TODAY).current).toBe(0);
  });

  it('reports the best run even when the current one is dead', () => {
    const s = streaks(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-10'], TODAY);
    expect(s.best).toBe(3);
    expect(s.current).toBe(0);
  });

  it('ignores repeats on the same day', () => {
    expect(streaks(['2026-03-15', '2026-03-15'], TODAY)).toEqual({ current: 1, best: 1 });
  });

  it('handles an empty history', () => {
    expect(streaks([], TODAY)).toEqual({ current: 0, best: 0 });
  });
});

describe('kitchenStats', () => {
  const base = {
    recipeById: recipesById,
    ingById,
    prices: new Map([['ground-turkey', 0.011]]),
    today: TODAY,
    now: NOW,
  };

  it('tallies cooks, distinct recipes and the top list', () => {
    const s = kitchenStats({
      ...base,
      cookLogs: [log('test-tacos', 1), log('test-tacos', 3), log('test-pasta', 5)],
      trips: [], txns: [],
    });
    expect(s.cooks).toBe(3);
    expect(s.distinctRecipes).toBe(2);
    expect(s.top[0]).toMatchObject({ recipeId: 'test-tacos', count: 2 });
  });

  it('honours the day window', () => {
    const logs = [log('test-tacos', 2), log('test-pasta', 200)];
    expect(kitchenStats({ ...base, cookLogs: logs, trips: [], txns: [], days: 30 }).cooks).toBe(1);
    expect(kitchenStats({ ...base, cookLogs: logs, trips: [], txns: [] }).cooks).toBe(2);
  });

  it('splits cuisines and proteins into shares that add up', () => {
    const s = kitchenStats({
      ...base,
      cookLogs: [log('test-tacos', 1), log('test-pasta', 2), log('test-curry', 3), log('test-curry', 4)],
      trips: [], txns: [],
    });
    expect(s.cuisines.find((c) => c.label === 'Indian')).toMatchObject({ count: 2, share: 0.5 });
    expect(s.proteins.find((p) => p.label === 'turkey')?.count).toBe(2);
  });

  it('reports spend and cost per cook from finished trips', () => {
    const s = kitchenStats({
      ...base,
      cookLogs: [log('test-tacos', 1), log('test-pasta', 2)],
      trips: [trip(3, 20, 10)], txns: [],
    });
    expect(s.spend).toBe(30);
    expect(s.trips).toBe(1);
    expect(s.costPerCook).toBe(15);
  });

  it('leaves cost per cook undefined with no prices recorded', () => {
    const s = kitchenStats({ ...base, cookLogs: [log('test-tacos', 1)], trips: [], txns: [] });
    expect(s.costPerCook).toBeUndefined();
  });

  it('sums waste and prices it when a price is known', () => {
    const s = kitchenStats({
      ...base,
      cookLogs: [],
      trips: [],
      txns: [waste('ground-turkey', 200, 2), waste('ground-turkey', 100, 4), waste('spaghetti', 50, 1)],
    });
    const turkey = s.waste.find((w) => w.ingredientId === 'ground-turkey')!;
    expect(turkey.qty).toBe(300);
    expect(turkey.events).toBe(2);
    expect(turkey.cost).toBeCloseTo(3.3, 5);
    expect(s.wasteCost).toBeCloseTo(3.3, 5);
    // No price for spaghetti, so it is listed but not costed.
    expect(s.waste.find((w) => w.ingredientId === 'spaghetti')?.cost).toBeUndefined();
  });

  it('ignores non-waste transactions', () => {
    const txns = [{ ...waste('ground-turkey', 200, 1), reason: 'cook' } as InventoryTxn];
    expect(kitchenStats({ ...base, cookLogs: [], trips: [], txns }).wasteCost).toBe(0);
  });

  it('survives a cook log pointing at a deleted recipe', () => {
    const s = kitchenStats({ ...base, cookLogs: [log('gone-forever', 1)], trips: [], txns: [] });
    expect(s.top[0].title).toBe('Deleted recipe');
  });
});

describe('staleFavorites', () => {
  const favTacos = { ...TEST_RECIPES[0], favorite: true };
  const recipes = [favTacos, ...TEST_RECIPES.slice(1)];

  it('surfaces a favorite cooked long ago', () => {
    const out = staleFavorites({ recipes, cookLogs: [log('test-tacos', 90)], meals: [], today: TODAY, now: NOW });
    expect(out[0].recipe.id).toBe('test-tacos');
    expect(out[0].daysAgo).toBe(90);
  });

  it('skips things cooked recently', () => {
    const out = staleFavorites({ recipes, cookLogs: [log('test-tacos', 3)], meals: [], today: TODAY, now: NOW });
    expect(out.map((x) => x.recipe.id)).not.toContain('test-tacos');
  });

  it('skips recipes already on the upcoming plan', () => {
    const out = staleFavorites({
      recipes, cookLogs: [log('test-tacos', 90)], meals: [meal('test-tacos', '2026-03-18')], today: TODAY, now: NOW,
    });
    expect(out.map((x) => x.recipe.id)).not.toContain('test-tacos');
  });

  it('ignores recipes you have never shown interest in', () => {
    const out = staleFavorites({ recipes: TEST_RECIPES, cookLogs: [], meals: [], today: TODAY, now: NOW });
    expect(out).toHaveLength(0);
  });

  it('includes a never-cooked five-star recipe', () => {
    const rated = [{ ...TEST_RECIPES[1], rating: 5 }];
    const out = staleFavorites({ recipes: rated, cookLogs: [], meals: [], today: TODAY, now: NOW });
    expect(out[0].daysAgo).toBeUndefined();
  });

  it('never suggests a side dish or an archived recipe', () => {
    const odd = [
      { ...TEST_RECIPES[0], favorite: true, role: 'side' as const },
      { ...TEST_RECIPES[1], favorite: true, archived: true },
    ];
    expect(staleFavorites({ recipes: odd, cookLogs: [], meals: [], today: TODAY, now: NOW })).toHaveLength(0);
  });

  it('respects the limit', () => {
    const many = TEST_RECIPES.map((r) => ({ ...r, favorite: true }));
    expect(staleFavorites({ recipes: many, cookLogs: [], meals: [], today: TODAY, now: NOW, limit: 2 })).toHaveLength(2);
  });
});

describe('lastCooked', () => {
  it('keeps the most recent time per recipe', () => {
    const m = lastCooked([log('test-tacos', 10), log('test-tacos', 2)]);
    expect(m.get('test-tacos')).toBe(at(2));
  });
});

describe('budgetStatus', () => {
  it('returns null when no budget is set', () => {
    expect(budgetStatus({ trips: [], today: TODAY, budget: 0 })).toBeNull();
  });

  it('counts only the last seven days', () => {
    const s = budgetStatus({ trips: [trip(2, 40), trip(20, 100)], today: TODAY, budget: 100 })!;
    expect(s.spent).toBe(40);
    expect(s.left).toBe(60);
    expect(s.over).toBe(false);
  });

  it('flags going over, and going over once the list is paid for', () => {
    const over = budgetStatus({ trips: [trip(1, 120)], today: TODAY, budget: 100 })!;
    expect(over.over).toBe(true);
    expect(over.ratio).toBeCloseTo(1.2, 5);

    const soon = budgetStatus({ trips: [trip(1, 80)], today: TODAY, budget: 100, pending: 40 })!;
    expect(soon.over).toBe(false);
    expect(soon.wouldBeOver).toBe(true);
  });
});

describe('pantryValue', () => {
  const prices = new Map([['ground-turkey', 0.01], ['spaghetti', 0.005]]);

  it('adds up by location and counts what it cannot price', () => {
    const v = pantryValue(
      [lot('ground-turkey', 1000, { location: 'freezer' }), lot('spaghetti', 400, { location: 'pantry' }), lot('avocado', 2)],
      prices,
    );
    expect(v.total).toBeCloseTo(12, 5);
    expect(v.byLocation.freezer).toBeCloseTo(10, 5);
    expect(v.byLocation.pantry).toBeCloseTo(2, 5);
    expect(v.pricedItems).toBe(2);
    expect(v.unpricedItems).toBe(1);
  });

  it('is zero for an empty kitchen', () => {
    expect(pantryValue([], prices).total).toBe(0);
  });
});

describe('deadStock', () => {
  const args = { ingById, recipes: TEST_RECIPES, meals: [], prices: new Map<string, number>(), today: TODAY };
  const old = (id: string, qty: number, days: number, location: 'fridge' | 'freezer' | 'pantry' = 'pantry') =>
    lot(id, qty, { location, addedAt: at(days) });

  it('flags long-held stock with nothing planned for it', () => {
    const out = deadStock({ ...args, lots: [old('spaghetti', 400, 90)] });
    expect(out[0]).toMatchObject({ ingredientId: 'spaghetti', daysHeld: 90 });
  });

  it('leaves recent stock alone', () => {
    expect(deadStock({ ...args, lots: [old('spaghetti', 400, 10)] })).toHaveLength(0);
  });

  it('gives the freezer twice the leash', () => {
    expect(deadStock({ ...args, lots: [old('ground-turkey', 500, 60, 'freezer')] })).toHaveLength(0);
    expect(deadStock({ ...args, lots: [old('ground-turkey', 500, 100, 'freezer')] })).toHaveLength(1);
  });

  it('skips anything an upcoming meal needs', () => {
    const out = deadStock({ ...args, lots: [old('spaghetti', 400, 90)], meals: [meal('test-pasta', '2026-03-20')] });
    expect(out).toHaveLength(0);
  });

  it('lists recipes that would use it up', () => {
    const out = deadStock({ ...args, lots: [old('spaghetti', 400, 90)] });
    expect(out[0].uses.map((r) => r.id)).toContain('test-pasta');
  });

  it('prices it when a price is known', () => {
    const out = deadStock({ ...args, lots: [old('spaghetti', 400, 90)], prices: new Map([['spaghetti', 0.005]]) });
    expect(out[0].value).toBeCloseTo(2, 5);
  });

  it('ignores staples you always keep', () => {
    const staple = ingById.get('olive-oil');
    if (staple?.alwaysOnHand) {
      expect(deadStock({ ...args, lots: [old('olive-oil', 500, 200)] })).toHaveLength(0);
    }
  });
});

describe('recipesUsing', () => {
  it('ranks recipes that lean hardest on the picked ingredients', () => {
    const out = recipesUsing({ ingredientIds: ['ground-turkey', 'spaghetti'], recipes: TEST_RECIPES, ingById });
    expect(out[0].recipe.id).toBe('test-pasta');
    expect(out[0].hits).toBe(2);
    expect(out[0].hitIds).toContain('spaghetti');
  });

  it('returns nothing for no picks', () => {
    expect(recipesUsing({ ingredientIds: [], recipes: TEST_RECIPES, ingById })).toHaveLength(0);
  });

  it('reports density as a share of the recipe list', () => {
    const out = recipesUsing({ ingredientIds: ['spaghetti'], recipes: TEST_RECIPES, ingById });
    const pasta = out.find((m) => m.recipe.id === 'test-pasta')!;
    expect(pasta.density).toBeCloseTo(1 / 3, 5);
  });
});

describe('collections', () => {
  const now = 1000;
  const list = [
    { id: 'c1', name: 'Weeknights', recipeIds: ['test-tacos'], createdAt: 1, updatedAt: 1 },
    { id: 'c2', name: 'Almost never', recipeIds: [], createdAt: 2, updatedAt: 2 },
  ];

  it('parses tolerantly and sorts by name', () => {
    const parsed = parseCollections([
      { id: 'b', name: 'Beta', recipeIds: ['x', 7] },
      { id: 'a', name: 'Alpha' },
      'nonsense',
      { name: 'no id' },
    ]);
    expect(parsed.map((c) => c.name)).toEqual(['Alpha', 'Beta']);
    expect(parsed[1].recipeIds).toEqual(['x']);
  });

  it('returns an empty list for garbage storage', () => {
    expect(parseCollections(undefined)).toEqual([]);
    expect(parseCollections({ nope: true })).toEqual([]);
  });

  it('toggles membership both ways and stamps the time', () => {
    const added = toggleMembership(list, 'c2', 'test-pasta', now);
    expect(added[1].recipeIds).toEqual(['test-pasta']);
    expect(added[1].updatedAt).toBe(now);
    expect(toggleMembership(added, 'c2', 'test-pasta', now)[1].recipeIds).toEqual([]);
  });

  it('leaves other collections untouched', () => {
    expect(toggleMembership(list, 'c2', 'test-pasta', now)[0]).toBe(list[0]);
  });

  it('finds which collections hold a recipe', () => {
    expect(collectionsOf(list, 'test-tacos').map((c) => c.id)).toEqual(['c1']);
    expect(collectionsOf(list, 'nope')).toHaveLength(0);
  });

  it('prunes recipes that no longer exist', () => {
    expect(pruneCollections(list, new Set(['other']))[0].recipeIds).toEqual([]);
  });
});

describe('journal', () => {
  const entries = parseJournal([
    { id: 'j1', recipeId: 'test-tacos', at: 100, note: 'Too salty', rating: 3 },
    { id: 'j2', recipeId: 'test-tacos', at: 300, note: 'Better', rating: 5 },
    { id: 'j3', recipeId: 'test-pasta', at: 200, note: 'Fine' },
    { id: 'bad' },
  ]);

  it('parses valid entries newest first', () => {
    expect(entries.map((e) => e.id)).toEqual(['j2', 'j3', 'j1']);
  });

  it('filters by recipe', () => {
    expect(entriesFor(entries, 'test-tacos')).toHaveLength(2);
  });

  it('averages the ratings it has', () => {
    expect(journalRating(entries, 'test-tacos')).toBe(4);
    expect(journalRating(entries, 'test-pasta')).toBeUndefined();
  });
});

describe('priceBook', () => {
  const trips: Trip[] = [
    { id: 't1', finishedAt: at(30), lines: [{ ingredientId: 'ground-turkey', qty: 454, price: 4.54 }] },
    { id: 't2', finishedAt: at(2), lines: [{ ingredientId: 'ground-turkey', qty: 454, price: 6.81 }] },
  ] as unknown as Trip[];

  it('keeps a history newest first', () => {
    const points = priceHistory(trips).get('ground-turkey')!;
    expect(points).toHaveLength(2);
    expect(points[0].paid).toBe(6.81);
  });

  it('reports the latest, low, high and the change since the first price', () => {
    const entry = priceBook(trips, ingById).find((e) => e.ingredientId === 'ground-turkey')!;
    expect(entry.latest).toBeCloseTo(6.81 / 454, 6);
    expect(entry.low).toBeCloseTo(4.54 / 454, 6);
    expect(entry.change).toBeCloseTo(0.5, 5);
  });

  it('leaves change undefined with a single price', () => {
    expect(priceBook([trips[0]], ingById)[0].change).toBeUndefined();
  });
});

describe('recipeToText', () => {
  const recipe = TEST_RECIPES[0];

  it('renders the title, every ingredient and every step', () => {
    const text = recipeToText(recipe, { ingById, servings: 4 });
    expect(text).toContain('Turkey Tacos');
    expect(text).toContain('INGREDIENTS');
    expect(text).toContain('STEPS');
    expect(text.toLowerCase()).toContain('ground turkey');
    expect(text).toContain('1. Cook.');
  });

  it('scales with the servings asked for', () => {
    const one = recipeToText(recipe, { ingById, servings: 4 });
    const two = recipeToText(recipe, { ingById, servings: 8 });
    expect(one).not.toBe(two);
    expect(two).toContain('Serves 8');
    expect(two).toContain('2 lb ground turkey');
  });

  it('includes the credit when asked', () => {
    expect(recipeToText(recipe, { ingById, credit: true })).toContain('example.com');
  });
});

describe('planToText', () => {
  it('lists each day and its meals', () => {
    const text = planToText({
      days: [
        { date: '2026-03-15', label: 'Sun Mar 15', meals: [{ slot: 'dinner', title: 'Turkey Tacos', servings: 4 }] },
        { date: '2026-03-16', label: 'Mon Mar 16', meals: [] },
      ],
    });
    expect(text).toContain('Sun Mar 15');
    expect(text).toContain('Turkey Tacos');
  });
});

describe('ingredient fixtures', () => {
  it('has the ingredients these tests lean on', () => {
    expect(ing('ground-turkey').baseUnit).toBeDefined();
  });
});
