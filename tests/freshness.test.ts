import { describe, expect, it } from 'vitest';
import { autoPlan } from '../src/domain/autoplan';
import { computeAlerts } from '../src/domain/forecast';
import { isOld, thawNeeds, useUpCandidates } from '../src/domain/freshness';
import { addDaysISO } from '../src/domain/dates';
import { amountOptions, defaultOption } from '../src/domain/units';
import { ing, ingById, lot, meal, recipesById, TEST_RECIPES } from './helpers';

const today = '2026-09-13';
const daysAgo = (n: number) => new Date(2026, 8, 13 - n, 12).getTime();

describe('freshness', () => {
  it('flags perishables that have been sitting around', () => {
    expect(isOld(lot('spinach', 100, { addedAt: daysAgo(6) }), ing('spinach'), today)).toBe(true);
    expect(isOld(lot('spinach', 100, { addedAt: daysAgo(1) }), ing('spinach'), today)).toBe(false);
    expect(isOld(lot('spinach', 100, { addedAt: daysAgo(20), location: 'freezer' }), ing('spinach'), today)).toBe(false);
  });

  it('only suggests using up what planned meals will not already use', () => {
    const base = { loose: [], ingById, recipesById, today };
    const old = lot('spinach', 150, { addedAt: daysAgo(6), expiresOn: addDaysISO(today, 4) });
    expect(useUpCandidates({ ...base, lots: [old], meals: [] }).map((u) => u.ing.id)).toEqual(['spinach']);
    // the curry uses 4 cups of spinach (~120 g); only a sliver remains
    const planned = [meal('test-curry', addDaysISO(today, 1))];
    const left = useUpCandidates({ ...base, lots: [{ ...old, qty: 120 }], meals: planned });
    expect(left).toHaveLength(0);
  });

  it('finds frozen food needed for upcoming meals', () => {
    const frozen = lot('salmon', 700, { location: 'freezer', expiresOn: '2026-12-01' });
    const needs = thawNeeds({
      lots: [frozen], loose: [], ingById, recipesById, today, meals: [meal('test-salmon', addDaysISO(today, 1))],
    });
    expect(needs).toHaveLength(1);
    expect(needs[0].thawBy).toBe(today);
    const alerts = computeAlerts({
      ingredients: ingById, recipes: recipesById, lots: [frozen, lot('spinach', 200, { addedAt: daysAgo(6) })], loose: [], txns: [],
      meals: [meal('test-salmon', addDaysISO(today, 1))], today, now: daysAgo(0), bufferDays: 3, shoppingDay: 0,
    });
    expect(alerts[0].kind).toBe('thaw');
    expect(alerts.some((a) => a.kind === 'old' && a.ingredientId === 'spinach')).toBe(true);
  });

  it('autoplan builds meals around items the user wants to use up', () => {
    const slots = [0, 1].map((i) => ({ date: addDaysISO(today, i), slot: 'dinner' as const }));
    const input = {
      slots, existing: [], recipes: TEST_RECIPES, ingById, lots: [lot('coconut-milk', 1, { addedAt: daysAgo(5) })], loose: [],
      recentCooks: [], settings: { dietFilters: [], dislikedIngredients: [], weeknightMaxMin: 0 }, servings: 4, today, now: 0, seed: 7,
    };
    const picks = autoPlan({ ...input, useUp: ['coconut-milk'] });
    expect(picks[0].recipeId).toBe('test-curry');
    expect(picks[0].reasons[0]).toMatch(/uses up your coconut milk/i);
  });
});

describe('unit flipping', () => {
  it('offers metric weight for a US volume amount', () => {
    const opts = amountOptions(2, 'cup', ing('all-purpose-flour'));
    expect(opts[0].text).toBe('2 cups');
    const g = opts.find((o) => o.unit === 'g')!;
    expect(g.qty).toBeGreaterThan(230);
    expect(g.qty).toBeLessThan(300);
    expect(defaultOption(opts, 'metric').unit).toBe('ml');
    expect(defaultOption(opts, 'us').unit).toBe('cup');
  });
  it('turns metric water into cups', () => {
    const opts = amountOptions(473, 'ml', ing('water'));
    expect(defaultOption(opts, 'us').text).toBe('2 cups');
  });
  it('keeps count/alias units as written in both systems', () => {
    const opts = amountOptions(3, 'clove', ing('garlic'));
    expect(defaultOption(opts, 'metric').unit).toBe('clove');
    expect(opts.some((o) => o.unit === 'g')).toBe(true);
  });
});
