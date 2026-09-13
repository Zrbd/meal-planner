import { describe, expect, it } from 'vitest';
import { autoPlan } from '../src/domain/autoplan';
import { recipeCoverage, availableByIngredient } from '../src/domain/coverage';
import { addDaysISO, isWeeknight, startOfWeekISO } from '../src/domain/dates';
import { computeAlerts, usageRate } from '../src/domain/forecast';
import { choosePackages } from '../src/domain/packages';
import { createIngredientMatcher, detectTimerSec, parseIngredientLine, parseQuantity, parseRecipeText } from '../src/domain/parse';
import { buildShoppingList } from '../src/domain/shopping';
import { buildDemands, planDeduction, simulate } from '../src/domain/stock';
import { formatNumber, formatQty, toBase } from '../src/domain/units';
import { INGREDIENTS } from '../src/data/ingredients';
import { RECIPES } from '../src/data/recipes';
import { DEFAULT_AISLE_ORDER } from '../src/data/aisles';
import { ing, ingById, lot, meal, recipesById } from './helpers';

describe('dates', () => {
  it('handles local ISO dates', () => {
    expect(addDaysISO('2026-02-28', 1)).toBe('2026-03-01');
    expect(startOfWeekISO('2026-09-12', 0)).toBe('2026-09-06');
    expect(isWeeknight('2026-09-13')).toBe(true); // Sunday
    expect(isWeeknight('2026-09-11')).toBe(false); // Friday
  });
});

describe('units', () => {
  it('converts via aliases, volume, and density', () => {
    expect(toBase(2, 'clove', ing('garlic'))).toBe(10);
    expect(toBase(1, 'cup', ing('milk'))).toBeCloseTo(236.6, 1);
    expect(toBase(1, 'lb', ing('ground-beef'))).toBeCloseTo(453.6, 1);
    expect(toBase(1, 'can', ing('black-beans'))).toBe(1);
    expect(toBase(2, 'cups', ing('parmesan'))).toBeCloseTo(198.7, 0);
    expect(() => toBase(1, 'cup', ing('eggs'))).toThrow();
  });
  it('formats friendly quantities', () => {
    expect(formatNumber(1.5)).toBe('1½');
    expect(formatNumber(0.33)).toBe('⅓');
    expect(formatQty(15, ing('garlic'))).toBe('3 cloves');
    expect(formatQty(680, ing('ground-beef'))).toBe('1½ lb');
  });
});

describe('packages', () => {
  it('picks the least overbuy', () => {
    const p = [{ label: '1 lb', qty: 453.6 }, { label: '2 lb', qty: 907.2 }];
    expect(choosePackages(500, p).total).toBeCloseTo(907.2);
    expect(choosePackages(450, p).items[0].count).toBe(1);
    expect(choosePackages(10, []).total).toBe(10);
  });
});

describe('stock simulator', () => {
  it('allocates FIFO by expiry and reports shortfalls', () => {
    const lots = [lot('eggs', 4, { expiresOn: '2026-09-20' }), lot('eggs', 12, { expiresOn: '2026-10-01' })];
    const demands = [
      { id: 'a', mealId: 'm', date: '2026-09-13', slotOrder: 0, ingredientId: 'eggs', qty: 6 },
      { id: 'b', mealId: 'n', date: '2026-09-14', slotOrder: 0, ingredientId: 'eggs', qty: 12 },
    ];
    const sim = simulate(lots, [], demands, ingById);
    expect(sim.allocations.get('a')![0].qty).toBe(4);
    expect(sim.shortfalls.get('b')).toBe(2);
  });
  it('ignores expired lots for future demand but deducts them when cooking', () => {
    const lots = [lot('milk', 500, { expiresOn: '2026-09-10' })];
    const sim = simulate(lots, [], [{ id: 'a', mealId: 'm', date: '2026-09-12', slotOrder: 0, ingredientId: 'milk', qty: 100 }], ingById);
    expect(sim.shortfalls.get('a')).toBe(100);
    expect(planDeduction(lots, 'milk', 100).missing).toBe(0);
  });
  it('treats loose items as available unless out', () => {
    const d = [{ id: 'a', mealId: 'm', date: '2026-09-12', slotOrder: 0, ingredientId: 'salt', qty: 5 }];
    expect(simulate([], [], d, ingById).shortfalls.size).toBe(0);
    expect(simulate([], [{ ingredientId: 'salt', level: 'out', updatedAt: 0 }], d, ingById).shortfalls.size).toBe(1);
  });
});

describe('shopping list', () => {
  const base = {
    today: '2026-09-12', recipes: recipesById, ingredients: ingById, loose: [], state: [],
    aisleOrder: DEFAULT_AISLE_ORDER, bufferDays: 3,
  };
  it('buys shortfalls in whole packages, net of pantry', () => {
    const meals = [meal('ground-beef-tacos', '2026-09-13'), meal('spaghetti-bolognese', '2026-09-14')];
    const res = buildShoppingList({ ...base, from: '2026-09-13', to: '2026-09-14', meals, lots: [lot('ground-beef', 200)] });
    const beef = res.lines.find((l) => l.ingredientId === 'ground-beef')!;
    expect(beef.need).toBeCloseTo(2 * 453.592 - 200, 0);
    expect(beef.buy).toBeGreaterThanOrEqual(beef.need);
    expect(beef.reasons).toHaveLength(2);
    expect(res.errors).toEqual([]);
    const tortillas = res.lines.find((l) => l.ingredientId === 'corn-tortillas')!;
    expect(tortillas.buy).toBe(30);
    // unknown spices go to double-check, not buy
    expect(res.lines.find((l) => l.ingredientId === 'chili-powder')!.section).toBe('check');
  });
  it('consumes stock for earlier meals outside the range first', () => {
    const meals = [meal('ground-beef-tacos', '2026-09-12'), meal('ground-beef-tacos', '2026-09-15', { recipeId: 'spaghetti-bolognese' })];
    const res = buildShoppingList({ ...base, from: '2026-09-15', to: '2026-09-15', meals, lots: [lot('ground-beef', 453.592)] });
    expect(res.lines.find((l) => l.ingredientId === 'ground-beef')!.need).toBeCloseTo(453.592, 0);
  });
  it('respects have-it and manual items', () => {
    const meals = [meal('ground-beef-tacos', '2026-09-13')];
    const res = buildShoppingList({
      ...base, from: '2026-09-13', to: '2026-09-13', meals, lots: [],
      state: [{ key: 'ground-beef', checked: false, haveIt: true }, { key: 'manual:1', checked: false, manualName: 'Paper towels' }],
    });
    expect(res.lines.find((l) => l.ingredientId === 'ground-beef')!.section).toBe('skipped');
    expect(res.lines.some((l) => l.name === 'Paper towels')).toBe(true);
  });
});

describe('forecast', () => {
  const now = new Date(2026, 8, 12, 12).getTime();
  it('computes usage rate from cook txns, ignoring waste', () => {
    const day = 86_400_000;
    const txns = [
      { id: '1', ingredientId: 'milk', delta: -280, reason: 'cook' as const, at: now - 2 * day },
      { id: '0', ingredientId: 'milk', delta: -1000, reason: 'waste' as const, at: now - 20 * day },
    ];
    expect(usageRate(txns, 'milk', now)).toBeGreaterThan(0);
    expect(usageRate(txns.slice(1), 'milk', now)).toBe(0);
  });
  it('alerts on shortages, staples, and expiry', () => {
    const alerts = computeAlerts({
      ingredients: ingById, recipes: recipesById, loose: [], txns: [], today: '2026-09-12', now, bufferDays: 3, shoppingDay: 6,
      lots: [lot('spinach', 100, { expiresOn: '2026-09-13' }), lot('eggs', 0.01)],
      meals: [meal('shakshuka', '2026-09-13')],
    });
    const kinds = alerts.map((a) => a.kind);
    expect(kinds).toContain('short'); // shakshuka needs 6 eggs
    expect(kinds).toContain('expiring');
  });
});

describe('coverage & autoplan', () => {
  it('scores recipes the pantry covers higher', () => {
    const r = recipesById.get('chickpea-coconut-curry')!;
    const lots = [lot('chickpeas', 2), lot('diced-tomatoes', 1), lot('coconut-milk', 1), lot('yellow-onion', 2)];
    const cov = recipeCoverage(r, 4, availableByIngredient(lots, '2026-09-12'), new Map(), ingById);
    expect(cov.ratio).toBeGreaterThan(0.4);
    expect(cov.missing).toContain('spinach');
  });
  it('fills slots with distinct eligible recipes, deterministically', () => {
    const slots = [0, 1, 2, 3, 4].map((i) => ({ date: addDaysISO('2026-09-13', i), slot: 'dinner' as const }));
    const input = {
      slots, existing: [], recipes: RECIPES, ingById, lots: [lot('salmon', 680, { expiresOn: '2026-09-14' })], loose: [],
      recentCooks: [], settings: { dietFilters: [], dislikedIngredients: [], weeknightMaxMin: 45 }, servings: 4,
      today: '2026-09-12', now: 0, seed: 42,
    };
    const picks = autoPlan(input);
    expect(picks).toHaveLength(5);
    expect(new Set(picks.map((p) => p.recipeId)).size).toBe(5);
    expect(picks[0].recipeId).toBe('lemon-garlic-salmon'); // rescues expiring salmon
    expect(autoPlan(input).map((p) => p.recipeId)).toEqual(picks.map((p) => p.recipeId));
    const veg = autoPlan({ ...input, settings: { ...input.settings, dietFilters: ['vegetarian'] } });
    for (const p of veg) expect(recipesById.get(p.recipeId)!.diet).toContain('vegetarian');
  });
  it('buildDemands skips leftovers and cooked meals', () => {
    const { demands } = buildDemands(
      [meal('shakshuka', '2026-09-13', { status: 'cooked' }), meal('shakshuka', '2026-09-14', { leftoverOf: 'x' })],
      recipesById, ingById,
    );
    expect(demands).toHaveLength(0);
  });
});

describe('parsing', () => {
  const match = createIngredientMatcher(INGREDIENTS);
  it('parses quantities', () => {
    expect(parseQuantity('1 1/2 cups')!.qty).toBe(1.5);
    expect(parseQuantity('½ tsp')!.qty).toBe(0.5);
    expect(parseQuantity('1½ tsp')!.qty).toBe(1.5);
    expect(parseQuantity('2-3 cloves')!.qty).toBe(3);
  });
  it('parses ingredient lines and matches catalog', () => {
    const a = parseIngredientLine('2 cups shredded mozzarella cheese', match);
    expect([a.qty, a.unit, a.ingredientId]).toEqual([2, 'cup', 'mozzarella']);
    const b = parseIngredientLine('- 3 cloves garlic, minced', match);
    expect([b.qty, b.unit, b.ingredientId, b.prep]).toEqual([3, 'clove', 'garlic', 'minced']);
    const c = parseIngredientLine('1 large yellow onion, diced', match);
    expect([c.qty, c.unit, c.ingredientId]).toEqual([1, 'ea', 'yellow-onion']);
    const d = parseIngredientLine('1.5 lbs boneless skinless chicken thighs', match);
    expect([d.unit, d.ingredientId]).toEqual(['lb', 'chicken-thighs']);
    expect(parseIngredientLine('Salt to taste', match).ingredientId).toBe('salt');
    expect(parseIngredientLine('1 (15 oz) can black beans, drained', match).ingredientId).toBe('black-beans');
  });
  it('parses a pasted recipe', () => {
    const text = `Grandma's Chili\nServes 6\nPrep time: 15 minutes\nCook time: 1 hour\n\nIngredients\n1 lb ground beef\n2 tbsp chili powder\n\nInstructions\n1. Brown the beef.\n2. Add everything and simmer 45 minutes.`;
    const r = parseRecipeText(text, match);
    expect(r.title).toBe("Grandma's Chili");
    expect(r.servings).toBe(6);
    expect(r.prepMin).toBe(15);
    expect(r.cookMin).toBe(60);
    expect(r.ingredients.map((i) => i.ingredientId)).toEqual(['ground-beef', 'chili-powder']);
    expect(r.steps).toEqual(['Brown the beef.', 'Add everything and simmer 45 minutes.']);
    expect(detectTimerSec(r.steps[1])).toBe(2700);
  });
});
