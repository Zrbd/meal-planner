import { describe, expect, it } from 'vitest';
import { INGREDIENTS } from '../src/data/ingredients';
import { defineRecipe } from '../src/data/recipes/define';
import { eligibleRecipes } from '../src/domain/autoplan';
import { CATEGORIES, categoryOf } from '../src/domain/categories';
import { addDaysISO } from '../src/domain/dates';
import { dishTypeOf, equipmentOf, isFullMeal, proteinTypeOf } from '../src/domain/dishes';
import { computeAlerts } from '../src/domain/forecast';
import { localMs, prepSteps, prepTasks, stepMinutes } from '../src/domain/prep';
import { recipeCost, spending, unitPrices } from '../src/domain/prices';
import { cookableRecipes } from '../src/domain/quickadd';
import { wasteHint } from '../src/domain/shopping';
import { recipeNeeds } from '../src/domain/stock';
import type { Ingredient, Recipe, Trip } from '../src/domain/types';
import { ing, ingById, lot, meal, recipesById } from './helpers';

const credit = { name: 'Test fixture', url: 'https://example.com' };
const TODAY = '2026-09-15';
const tacos = recipesById.get('test-tacos')!;
const pasta = recipesById.get('test-pasta')!;
const garlicRice = defineRecipe({
  id: 'test-rice', title: 'Garlic Rice', description: '', servings: 4, prep: 5, cook: 20, cuisine: 'American', credit,
  ingredients: [[1.5, 'cup', 'white-rice'], [3, 'clove', 'garlic']],
  steps: ['Simmer the rice in a saucepan.'],
});
const settings = { dietFilters: [], dislikedIngredients: [], weeknightMaxMin: 0 } as never;

describe('dishes', () => {
  it('classifies protein mains vs sides', () => {
    expect(proteinTypeOf(tacos, ingById)).toBe('turkey');
    expect(dishTypeOf(tacos, ingById)).toBe('main');
    expect(isFullMeal(tacos, ingById)).toBe(true);
    expect(dishTypeOf(garlicRice, ingById)).toBe('side');
    expect(isFullMeal(garlicRice, ingById)).toBe(false);
  });

  it('finds the cookware a recipe uses', () => {
    const r = { ...tacos, steps: ['Bring a large pot of water to a boil.', 'Brown the turkey in a skillet over medium heat.', 'Roast on a sheet pan.'] };
    expect(equipmentOf(r).map((e) => e.id)).toEqual(['large-pot', 'skillet', 'sheet-pan']);
  });

  it('dinner suggestions skip sides when full meals exist', () => {
    const recipes = [tacos, garlicRice].map((r) => ({ ...r, slots: ['dinner' as const] }));
    expect(eligibleRecipes(recipes, 'dinner', TODAY, settings, ingById).map((r) => r.id)).toEqual(['test-tacos']);
    expect(eligibleRecipes(recipes, 'lunch', TODAY, settings, ingById)).toEqual([]);
  });
});

describe('categories', () => {
  it('gives every ingredient a known category', () => {
    const ids = new Set(CATEGORIES.map((c) => c.id));
    for (const i of INGREDIENTS) expect(ids.has(categoryOf(i))).toBe(true);
    expect(categoryOf(ing('chicken-thighs'))).toBe('meat');
    expect(categoryOf(ing('spinach'))).toBe('vegetables');
    expect(categoryOf(ing('feta'))).toBe('cheese');
    expect(categoryOf(ing('chickpeas'))).toBe('plant-protein');
  });
});

describe('quick add', () => {
  const stockFor = (r: Recipe) =>
    [...recipeNeeds(r, 4, ingById).needs].filter(([id]) => ingById.get(id)!.trackMode === 'exact').map(([id, q]) => lot(id, q));

  it('only offers recipes fully covered by what you have', () => {
    const got = cookableRecipes({ recipes: [tacos, pasta], date: TODAY, slot: 'dinner', servings: 4, meals: [], lots: stockFor(tacos), loose: [], ingById, today: TODAY });
    expect(got.map((c) => c.recipe.id)).toEqual(['test-tacos']);
  });

  it("won't take food a planned meal needs", () => {
    const planned = [meal('test-pasta', addDaysISO(TODAY, 2))];
    const got = cookableRecipes({ recipes: [tacos, pasta], date: TODAY, slot: 'dinner', servings: 4, meals: planned, lots: stockFor(tacos), loose: [], ingById, today: TODAY });
    expect(got).toEqual([]);
  });
});

describe('prices', () => {
  const trip = (at: number, lines: Trip['lines']): Trip => ({ id: `t${at}`, range: [TODAY, TODAY], finishedAt: at, lines });

  it('uses the latest price per unit and costs recipes by amount used', () => {
    const trips = [
      trip(localMs(TODAY, '09:00'), [{ ingredientId: 'ground-turkey', name: 'Turkey', qty: 500, price: 10 }]),
      trip(localMs(addDaysISO(TODAY, -20), '09:00'), [{ ingredientId: 'ground-turkey', name: 'Turkey', qty: 500, price: 5 }]),
    ];
    const prices = unitPrices(trips);
    expect(prices.get('ground-turkey')).toBeCloseTo(0.02);
    const cost = recipeCost(tacos, 4, ingById, prices);
    expect(cost.total).toBeCloseTo(recipeNeeds(tacos, 4, ingById).needs.get('ground-turkey')! * 0.02);
    expect(cost.priced).toBe(1);
    expect(cost.unpriced).toBeGreaterThan(0);

    const s = spending(trips, TODAY);
    expect(s).toMatchObject({ week: 10, total: 15, trips: 2 });
  });
});

describe('prep ahead', () => {
  const marinated = { ...tacos, steps: ['Marinate the turkey for 4 hours.', 'Let rest 5 minutes.', 'Cook.'] };
  const byId = new Map([[marinated.id, marinated]]);

  it('reads waiting times from steps', () => {
    expect(stepMinutes('Marinate for 2-4 hours')).toBe(120);
    expect(stepMinutes('Soak the beans overnight')).toBe(480);
    expect(stepMinutes('Chill 30 minutes')).toBe(30);
    expect(prepSteps(marinated).map((s) => [s.kind, s.minutes])).toEqual([['marinate', 240]]);
  });

  it('schedules the start time before cooking', () => {
    const [t] = prepTasks({ meals: [meal(marinated.id, TODAY)], recipesById: byId, today: TODAY });
    expect(t.startAt).toBe(localMs(TODAY, '13:00'));
    expect(t.cookAt).toBe(localMs(TODAY, '17:00'));
  });

  it('alerts ahead of time and again when it is time to start', () => {
    const meals = [meal(marinated.id, TODAY)];
    const at = (time: string) =>
      computeAlerts({ ingredients: ingById, recipes: byId, lots: [], loose: [], txns: [], meals, today: TODAY, now: localMs(TODAY, time), bufferDays: 3, shoppingDay: 0 })
        .filter((a) => a.kind === 'prep')
        .map((a) => a.id.split(':')[0]);
    expect(at('08:00')).toEqual(['prep']);
    expect(at('12:45')).toEqual(['prep-now']);
    expect(at('17:30')).toEqual([]);
  });
});

describe('waste-free buying', () => {
  const spinach = ing('spinach'); // produce, 5 days in the fridge
  const tenOz = 283;

  it('suggests buying loose when the extra would spoil', () => {
    const h = wasteHint(spinach, tenOz, 150, TODAY, [], 0);
    expect(h).toMatchObject({ fix: 'loose', exact: 150, useBy: addDaysISO(TODAY, 5) });
    expect(h!.qty).toBeCloseTo(133);
  });

  it('stays quiet when a later meal uses the extra in time', () => {
    expect(wasteHint(spinach, tenOz, 150, TODAY, [{ date: addDaysISO(TODAY, 3), qty: 140 }], 0)).toBeUndefined();
    expect(wasteHint(spinach, tenOz, 150, TODAY, [{ date: addDaysISO(TODAY, 9), qty: 140 }], 0)).toBeDefined();
  });

  it('suggests freezing or planning when it can only be bought packaged', () => {
    const dairy: Ingredient = { ...spinach, aisle: 'dairy' };
    expect(wasteHint(dairy, tenOz, 150, TODAY, [], 0)?.fix).toBe('plan');
    expect(wasteHint({ ...dairy, shelfLife: { fridge: 5, freezer: 60 } }, tenOz, 150, TODAY, [], 0)?.fix).toBe('freeze');
    expect(wasteHint({ ...spinach, shelfLife: { pantry: 60 }, defaultLocation: 'pantry' }, tenOz, 150, TODAY, [], 0)).toBeUndefined();
  });
});
