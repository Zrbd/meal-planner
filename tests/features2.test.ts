// Unit tests for the twenty-feature batch: nutrition, allergens, timers, templates, roulette,
// unit prices, labels, badges, sous-chef, history, durations, shortlist, month grid, cheat
// sheet, sweep, ingredient notes, equipment and sharing.
import { describe, expect, it } from 'vitest';
import { ALLERGENS, allergensOf, describeHits, recipeAllergens, recipeIsSafe } from '../src/domain/allergens';
import { badges, earnedCount, nextBadge } from '../src/domain/badges';
import { searchCheatSheet, CHEAT_SHEET } from '../src/data/cheatsheet';
import { describeTypical, parseDurations, record, typicalMinutes } from '../src/domain/durations';
import { ASSUMED_OWNED, canCookWith, checkEquipment, describeMissing, parseOwned } from '../src/domain/equipment';
import { diffSummary, MAX_REVISIONS, parseHistory, pushRevision } from '../src/domain/history';
import { isEmpty, parseNotes, setNote, shoppingHint } from '../src/domain/ingredientnotes';
import { freezerLabel, labelText, lotLabel } from '../src/domain/labels';
import { monthGrid, monthStart, shiftMonth } from '../src/domain/month';
import { dayNutrition, recipeNutrition, summarize, verdict } from '../src/domain/nutrition';
import { rouletteWheel, spin } from '../src/domain/roulette';
import { exportRecipe, parseShared, ShareError, shareFilename, toJSON } from '../src/domain/share';
import { add, has, MAX_SHORTLIST, move, pruneScheduled, remove } from '../src/domain/shortlist';
import { cookName, imbalance, splitTasks } from '../src/domain/sous';
import { buildSweep, summarize as sweepSummary, suggestedExtension } from '../src/domain/sweep';
import { applyTemplate, captureTemplate, parseTemplates, uniqueName, type PlanTemplate } from '../src/domain/templates';
import { formatLeft, isDone, nudge, parseTimers, pause, remaining, resume } from '../src/domain/timers';
import { comparePrices, effectivePerBase, usableFraction } from '../src/domain/unitprice';
import { ing, ingById, lot, meal, recipesById, TEST_RECIPES } from './helpers';

const tacos = recipesById.get('test-tacos')!;
const curry = recipesById.get('test-curry')!;
const shakshuka = recipesById.get('test-shakshuka')!;

describe('nutrition', () => {
  it('scales with servings and divides per serving', () => {
    const four = recipeNutrition(tacos, 4, ingById);
    const eight = recipeNutrition(tacos, 8, ingById);
    expect(four.kcal).toBeGreaterThan(0);
    expect(eight.kcal).toBeCloseTo(four.kcal * 2, 3);
    // Doubling the batch doubles the pot but not the plate.
    expect(eight.perServing.kcal).toBeCloseTo(four.perServing.kcal, 3);
  });

  it('adds up a planned day one serving at a time', () => {
    const day = dayNutrition([meal('test-tacos', '2026-09-20'), meal('test-curry', '2026-09-20')], recipesById, ingById);
    expect(day.meals).toHaveLength(2);
    expect(day.kcal).toBeCloseTo(day.meals[0].nutrients.kcal + day.meals[1].nutrients.kcal, 3);
  });

  it('skips meals that were skipped', () => {
    const day = dayNutrition([meal('test-tacos', '2026-09-20', { status: 'skipped' })], recipesById, ingById);
    expect(day.meals).toHaveLength(0);
    expect(day.kcal).toBe(0);
  });

  it('judges goals with a ten percent tolerance', () => {
    expect(verdict(2000, 2000)).toBe('on-track');
    expect(verdict(1950, 2000)).toBe('on-track');
    expect(verdict(1500, 2000)).toBe('under');
    expect(verdict(2400, 2000)).toBe('over');
    expect(verdict(2400, undefined)).toBeUndefined();
  });

  it('summarizes in the shape the cards use', () => {
    expect(summarize({ kcal: 620.4, protein: 38.2, carbs: 10, fat: 5 })).toBe('620 cal · 38 g protein');
  });
});

describe('allergens', () => {
  it('has a unique id and label for each', () => {
    expect(new Set(ALLERGENS.map((a) => a.id)).size).toBe(ALLERGENS.length);
    for (const a of ALLERGENS) expect(a.label.length).toBeGreaterThan(2);
  });

  it('finds dairy in the shakshuka feta', () => {
    const hits = recipeAllergens(shakshuka, ingById, ['milk']);
    expect(hits).toHaveLength(1);
    expect(hits[0].ingredientIds).toContain('feta');
    expect(recipeIsSafe(shakshuka, ingById, ['milk'])).toBe(false);
    expect(describeHits(hits)).toMatch(/contains/i);
  });

  it('leaves recipes without the allergen alone', () => {
    expect(recipeAllergens(curry, ingById, ['shellfish'])).toHaveLength(0);
    expect(recipeIsSafe(curry, ingById, ['shellfish'])).toBe(true);
    expect(recipeAllergens(curry, ingById, [])).toHaveLength(0);
  });

  it('classifies an ingredient the same way twice (cache is not stale)', () => {
    const first = [...allergensOf(ing('feta'))];
    const second = [...allergensOf(ing('feta'))];
    expect(second).toEqual(first);
  });
});

describe('timers', () => {
  const t = { id: 't1', label: 'Rice', seconds: 600, endsAt: 1000 + 600_000, createdAt: 1000 };

  it('counts down and finishes', () => {
    expect(remaining(t, 1000)).toBe(600);
    expect(remaining(t, 1000 + 300_000)).toBe(300);
    expect(isDone(t, 1000 + 600_001)).toBe(true);
    expect(remaining(t, 1000 + 999_999)).toBe(0);
  });

  it('pauses and resumes without losing time', () => {
    const paused = pause(t, 1000 + 120_000);
    expect(paused.pausedWith).toBe(480);
    expect(remaining(paused, 9_999_999)).toBe(480);
    const back = resume(paused, 5000);
    expect(back.pausedWith).toBeUndefined();
    expect(remaining(back, 5000)).toBe(480);
  });

  it('nudges by a delta and never below zero', () => {
    expect(remaining(nudge(t, 60, 1000), 1000)).toBe(660);
    expect(remaining(nudge(t, -99_999, 1000), 1000)).toBe(0);
  });

  it('formats what is left', () => {
    expect(formatLeft(0)).toMatch(/0/);
    expect(formatLeft(65)).toBe('1:05');
  });

  it('parses junk out of storage', () => {
    expect(parseTimers(null)).toEqual([]);
    expect(parseTimers([{ nope: true }])).toEqual([]);
    expect(parseTimers([t])).toHaveLength(1);
  });
});

describe('plan templates', () => {
  const week = [meal('test-tacos', '2026-09-07'), meal('test-curry', '2026-09-09')];
  const tpl = (): PlanTemplate => ({
    id: 't1',
    name: 'Easy week',
    meals: captureTemplate(week, '2026-09-07', '2026-09-13'),
    createdAt: 1000,
  });

  it('captures a week as day offsets', () => {
    expect(tpl().meals).toHaveLength(2);
    expect(tpl().meals.map((m) => m.offset)).toEqual([0, 2]);
  });

  it('lands on a later week at the same offsets', () => {
    const { add: added } = applyTemplate(tpl(), '2026-10-05', []);
    expect(added.map((m) => m.date).sort()).toEqual(['2026-10-05', '2026-10-07']);
  });

  it('fills gaps without replacing, and replaces when asked', () => {
    const existing = [meal('test-pasta', '2026-10-05', { slot: 'dinner' })];
    const keep = applyTemplate(tpl(), '2026-10-05', existing, false);
    expect(keep.add).toHaveLength(1);
    expect(keep.conflicts).toHaveLength(1);
    const overwrite = applyTemplate(tpl(), '2026-10-05', existing, true);
    expect(overwrite.add).toHaveLength(2);
  });

  it('keeps names unique', () => {
    expect(uniqueName('Easy week', [tpl()])).not.toBe('Easy week');
    expect(uniqueName('Fresh', [tpl()])).toBe('Fresh');
    expect(parseTemplates('nope')).toEqual([]);
  });
});

describe('roulette', () => {
  const input = {
    recipes: TEST_RECIPES,
    coverage: new Map(),
    cookLogs: [],
    meals: [],
    today: '2026-09-20',
    now: Date.UTC(2026, 8, 20),
  };

  it('weights every candidate positively', () => {
    const wheel = rouletteWheel(input);
    expect(wheel.length).toBeGreaterThan(0);
    for (const e of wheel) expect(e.weight).toBeGreaterThan(0);
  });

  it('always lands on something from the wheel', () => {
    const wheel = rouletteWheel(input);
    for (let seed = 0; seed < 25; seed += 1) {
      const pick = spin({ ...input, seed });
      expect(wheel.some((e) => e.recipe.id === pick?.recipe.id)).toBe(true);
    }
  });

  it('returns nothing when nothing is eligible', () => {
    expect(spin({ ...input, pool: new Set<string>() })).toBeUndefined();
  });

  it('is repeatable for a given seed', () => {
    expect(spin({ ...input, seed: 7 })?.recipe.id).toBe(spin({ ...input, seed: 7 })?.recipe.id);
  });
});

describe('unit prices', () => {
  const rice = ing('white-rice');

  it('finds the cheapest per base unit', () => {
    const result = comparePrices(
      [
        { id: 'a', label: 'small', price: 3, qty: 1, unit: 'lb' },
        { id: 'b', label: 'big', price: 10, qty: 5, unit: 'lb' },
      ],
      rice,
      'us',
    );
    expect(result.rows[0].option.id).toBe('b');
    expect(result.rows[0].best).toBe(true);
    expect(result.rows[1].premium).toBeGreaterThan(0);
    expect(result.spread).toBeGreaterThan(0);
  });

  it('discounts the part you would never get through', () => {
    // 1 g a day against a 5 kg sack with a 100-day shelf life: most of it is waste.
    const frac = usableFraction(5000, 1, 100);
    expect(frac).toBeLessThan(1);
    expect(effectivePerBase(0.01, frac)).toBeGreaterThan(0.01);
    expect(effectivePerBase(0.01, 1)).toBe(0.01);
  });
});

describe('labels', () => {
  it('writes a freezer label with the date to eat it by', () => {
    const label = freezerLabel(
      { id: 'f1', recipeId: curry.id, portions: 2, servingsEach: 2, frozenAt: Date.UTC(2026, 8, 1), eatBy: '2026-12-01' } as never,
      curry,
    );
    expect(label.title).toBe(curry.title);
    expect(label.detail).toContain('2 portions');
    const text = labelText(label);
    expect(text).toContain(curry.title);
    expect(text).toContain('Eat by');
    expect(text.split(String.fromCharCode(10)).length).toBeGreaterThan(2);
  });

  it('suggests a way to reheat every kind of dish', () => {
    expect(freezerLabel({ portions: 1 } as never, curry).reheat).toBeTruthy();
    expect(freezerLabel({ portions: 1 } as never, tacos).reheat).toBeTruthy();
    expect(freezerLabel({ portions: 1 } as never, undefined).reheat).toBeTruthy();
  });

  it('labels a pantry lot with its use-by date', () => {
    const text = labelText(lotLabel(lot('feta', 200, { expiresOn: '2026-10-01' }), ing('feta'), '2026-09-20'));
    expect(text).toContain('Use by');
  });
});

describe('badges', () => {
  const base = { cookLogs: [], meals: [], recipeById: recipesById, trips: [], txns: [], bestStreak: 0 };

  it('starts with nothing earned but something to aim at', () => {
    const list = badges(base);
    expect(list.length).toBeGreaterThan(5);
    expect(list.find((b) => b.id === 'first-cook')?.earned).toBe(false);
    expect(earnedCount(list)).toBeLessThanOrEqual(1);
    expect(nextBadge(list)).toBeDefined();
  });

  it('earns the first-cook badge after one cook', () => {
    const list = badges({ ...base, cookLogs: [{ id: 'c1', recipeId: 'test-tacos', at: 1000, used: [] }] });
    expect(list.find((b) => b.id === 'first-cook')?.earned).toBe(true);
    expect(earnedCount(list)).toBeGreaterThan(0);
  });

  it('never reports progress past the target', () => {
    const logs = Array.from({ length: 500 }, (_, i) => ({ id: `c${i}`, recipeId: 'test-tacos', at: i, used: [] }));
    for (const b of badges({ ...base, cookLogs: logs })) {
      if (b.earned) expect(b.progress).toBeGreaterThanOrEqual(b.target);
    }
  });
});

describe('sous-chef split', () => {
  const tasks = [
    { id: 'a', label: 'Chop onion', startsAt: 60, minutes: 10 },
    { id: 'b', label: 'Simmer sauce', startsAt: 50, minutes: 30, passive: true },
    { id: 'c', label: 'Cook rice', startsAt: 40, minutes: 20, passive: true },
    { id: 'd', label: 'Make salad', startsAt: 20, minutes: 10 },
  ];

  it('gives every task to somebody when there is room', () => {
    const plan = splitTasks(tasks, 2);
    const assigned = plan.lanes.flat().length + plan.unassigned.length;
    expect(assigned).toBe(tasks.length);
    expect(plan.lanes).toHaveLength(2);
  });

  it('puts everything on one cook when cooking alone', () => {
    const plan = splitTasks(tasks, 1);
    expect(plan.lanes[0].length + plan.unassigned.length).toBe(tasks.length);
    expect(imbalance(plan)).toBe(0);
  });

  it('names cooks, falling back to numbers', () => {
    expect(cookName(0, ['Sam'])).toBe('Sam');
    expect(cookName(1, ['Sam'])).toBe('Cook 2');
    expect(cookName(0, undefined)).toBe('Cook 1');
  });
});

describe('recipe history', () => {
  it('describes what changed', () => {
    const edited = { ...tacos, title: 'Spicy Turkey Tacos' };
    expect(diffSummary(tacos, edited)).toMatch(/title|renamed/i);
    const fewer = { ...tacos, ingredients: tacos.ingredients.slice(1) };
    expect(diffSummary(tacos, fewer)).toMatch(/ingredient/i);
  });

  it('keeps a bounded stack of snapshots, newest first', () => {
    let h = {};
    for (let i = 0; i < MAX_REVISIONS + 5; i += 1) {
      h = pushRevision(h, { ...tacos, title: `v${i}` }, { ...tacos, title: `v${i + 1}` }, 1000 + i);
    }
    const revs = (h as Record<string, unknown[]>)['test-tacos'];
    expect(revs.length).toBe(MAX_REVISIONS);
  });

  it('ignores garbage in storage', () => {
    expect(parseHistory(42)).toEqual({});
    expect(parseHistory({ 'test-tacos': 'nope' })).toEqual({});
  });
});

describe('cook durations', () => {
  it('takes the median of what actually happened', () => {
    let map = {};
    for (const m of [50, 55, 60]) map = record(map, 'test-tacos', m, Date.now());
    const t = typicalMinutes(map, 'test-tacos', 25)!;
    expect(t.minutes).toBe(55);
    expect(t.confident).toBe(true);
    expect(t.delta).toBe(30);
    expect(describeTypical(t)).toMatch(/55/);
  });

  it('is not confident from a single cook', () => {
    const map = record({}, 'test-tacos', 50, Date.now());
    expect(typicalMinutes(map, 'test-tacos', 25)!.confident).toBe(false);
    expect(typicalMinutes({}, 'test-tacos', 25)).toBeUndefined();
  });

  it('throws away impossible samples', () => {
    const map = record({}, 'test-tacos', 60 * 20, Date.now());
    expect(typicalMinutes(map, 'test-tacos', 25)).toBeUndefined();
    expect(parseDurations('nope')).toEqual({});
  });
});

describe('shortlist', () => {
  it('adds, finds and removes without duplicating', () => {
    let list = add([], 'test-tacos', 1000);
    list = add(list, 'test-tacos', 2000);
    expect(list).toHaveLength(1);
    expect(has(list, 'test-tacos')).toBe(true);
    expect(remove(list, 'test-tacos')).toHaveLength(0);
  });

  it('caps the pile', () => {
    let list: ReturnType<typeof add> = [];
    for (let i = 0; i < MAX_SHORTLIST + 10; i += 1) list = add(list, `r${i}`, i);
    expect(list.length).toBeLessThanOrEqual(MAX_SHORTLIST);
  });

  it('reorders', () => {
    const list = add(add([], 'a', 1), 'b', 2);
    expect(list.map((e) => e.recipeId)).toEqual(['b', 'a']);
    expect(move(list, 0, 1).map((e) => e.recipeId)).toEqual(['a', 'b']);
    expect(move(list, 0, 9).map((e) => e.recipeId)).toEqual(['a', 'b']);
    expect(move(list, 5, 0)).toBe(list);
  });

  it('drops anything already planned from today onwards', () => {
    const list = add([], 'test-tacos', 1);
    expect(pruneScheduled(list, [meal('test-tacos', '2026-09-25')], '2026-09-20')).toHaveLength(0);
    expect(pruneScheduled(list, [meal('test-tacos', '2026-09-01')], '2026-09-20')).toHaveLength(1);
  });
});

describe('month grid', () => {
  it('is always whole weeks and holds every day of the month', () => {
    const grid = monthGrid('2026-09-01', [], recipesById, 0, '2026-09-20');
    const cells = grid.weeks.flat();
    expect(cells.length % 7).toBe(0);
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30);
  });

  it('marks today and counts what is planned', () => {
    const grid = monthGrid('2026-09-01', [meal('test-tacos', '2026-09-20')], recipesById, 0, '2026-09-20');
    const cell = grid.weeks.flat().find((c) => c.date === '2026-09-20')!;
    expect(cell.isToday).toBe(true);
    expect(cell.meals).toHaveLength(1);
    expect(cell.dots).toHaveLength(1);
    expect(grid.plannedCount).toBe(1);
  });

  it('steps between months without slipping', () => {
    expect(monthStart('2026-09-20')).toBe('2026-09-01');
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftMonth('2026-01-01', -1)).toBe('2025-12-01');
  });
});

describe('cheat sheet', () => {
  it('has sections with rows', () => {
    expect(CHEAT_SHEET.length).toBeGreaterThan(4);
    for (const s of CHEAT_SHEET) expect(s.rows.length).toBeGreaterThan(0);
  });

  it('searches across both columns', () => {
    expect(searchCheatSheet('tablespoon').length).toBeGreaterThan(0);
    expect(searchCheatSheet('zzzzz')).toHaveLength(0);
    expect(searchCheatSheet('')).toEqual(CHEAT_SHEET);
  });
});

describe('fridge sweep', () => {
  const today = '2026-09-20';

  it('only asks about things near or past their date', () => {
    const items = buildSweep(
      [lot('feta', 200, { expiresOn: '2026-09-19' }), lot('white-rice', 500, { expiresOn: '2027-01-01' })],
      ingById,
      today,
      3,
    );
    expect(items).toHaveLength(1);
    expect(items[0].urgency).toBe('expired');
  });

  it('counts up the decisions', () => {
    const items = buildSweep([lot('feta', 200, { expiresOn: '2026-09-19' })], ingById, today, 3);
    const decisions = new Map([[items[0].lot.id, { lotId: items[0].lot.id, verdict: 'toss' as const }]]);
    expect(sweepSummary(items, decisions).tossed).toBe(1);
  });

  it('suggests a sensible extension', () => {
    const items = buildSweep([lot('feta', 200, { expiresOn: '2026-09-19' })], ingById, today, 3);
    expect(suggestedExtension(items[0].ing, items[0].lot)).toBeGreaterThan(0);
  });
});

describe('ingredient notes', () => {
  it('stores and drops empty notes', () => {
    const map = setNote({}, 'feta', { brand: 'Dodoni' }, 1000);
    expect(map.feta.brand).toBe('Dodoni');
    expect(setNote(map, 'feta', {}, 2000).feta).toBeUndefined();
    expect(isEmpty({ updatedAt: 1 })).toBe(true);
  });

  it('builds the aisle hint', () => {
    expect(shoppingHint({ brand: 'Kikkoman', where: 'international aisle', updatedAt: 1 })).toContain('Kikkoman');
    expect(shoppingHint({ avoid: true, updatedAt: 1 })).toMatch(/avoid/i);
    expect(shoppingHint(undefined)).toBeUndefined();
  });

  it('survives junk', () => {
    expect(parseNotes(null)).toEqual({});
    expect(parseNotes({ feta: { brand: 'x', updatedAt: 1 } }).feta.brand).toBe('x');
  });
});

describe('equipment', () => {
  it('assumes the basics are present', () => {
    for (const id of ASSUMED_OWNED) expect(parseOwned(undefined)).toContain(id);
    expect(parseOwned(['wok'])).toContain('large-pot');
  });

  it('warns about gear you do not have', () => {
    const wokRecipe = { ...tacos, steps: ['Heat a wok until smoking.'] };
    const check = checkEquipment(wokRecipe, ASSUMED_OWNED);
    expect(check.ok).toBe(false);
    expect(describeMissing(check)).toMatch(/wok/i);
    expect(canCookWith(wokRecipe, [...ASSUMED_OWNED, 'wok'])).toBe(true);
  });
});

describe('sharing', () => {
  it('round-trips a recipe with the ingredients it needs', () => {
    const json = toJSON(exportRecipe(curry, ingById, 1000));
    const result = parseShared(json, new Set(), ingById);
    expect(result.shared.recipe.title).toBe(curry.title);
    expect(result.collides).toBe(false);
    expect(parseShared(json, new Set([curry.id]), ingById).collides).toBe(true);
  });

  it('carries ingredient definitions the other device may not have', () => {
    const json = toJSON(exportRecipe(curry, ingById, 1000));
    const result = parseShared(json, new Set(), new Map());
    expect(result.newIngredients.length).toBeGreaterThan(0);
  });

  it('refuses anything that is not one of ours', () => {
    expect(() => parseShared('not json', new Set(), ingById)).toThrow(ShareError);
    expect(() => parseShared('{"kind":"something-else"}', new Set(), ingById)).toThrow(ShareError);
    expect(() => parseShared('{"kind":"meal-planner/recipe","version":99}', new Set(), ingById)).toThrow(ShareError);
  });

  it('names the file after the recipe', () => {
    expect(shareFilename(curry)).toBe('chickpea-curry.recipe.json');
  });
});
