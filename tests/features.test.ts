import { describe, expect, it } from 'vitest';
import { weekBalance } from '../src/domain/balance';
import { expiryCalendar, rescueRecipes } from '../src/domain/expirycalendar';
import {
  FREEZER_DAYS, batchServings, freezerExpiring, leftoverSlots, parseFreezer, takePortion, type FreezerMeal,
} from '../src/domain/leftovers';
import { buildTimeline, formatClock, parseClock } from '../src/domain/mealtimeline';
import { buildMenuCard, menuCardText } from '../src/domain/menucard';
import { RECENT_LIMIT, parseRecent, pushRecent } from '../src/domain/recent';
import { comingSoon, inSeason, outOfSeason, seasonalPicks } from '../src/domain/seasons';
import { SMART_COLLECTIONS, smartById, smartCounts, smartMembers, type SmartContext } from '../src/domain/smartcollections';
import { groupByStore, storeFor, storeStops, type StoreAssignment } from '../src/domain/storeplan';
import { ingById, lot, meal, recipesById, TEST_RECIPES } from './helpers';

const TODAY = '2026-07-15'; // a Wednesday, high summer
const SPRING = '2026-04-15'; // spinach and broccoli weather
const DAY = 86_400_000;
const NOW = new Date(2026, 6, 15, 12).getTime();

describe('seasons', () => {
  it('knows what is peaking', () => {
    expect(inSeason('tomato', TODAY)).toBe(true);
    expect(inSeason('tomato', '2026-01-15')).toBe(false);
    expect(inSeason('olive-oil', TODAY)).toBe(false); // no season at all
  });

  it('separates "no season" from "out of season"', () => {
    expect(outOfSeason('tomato', '2026-01-15')).toBe(true);
    expect(outOfSeason('olive-oil', '2026-01-15')).toBe(false);
  });

  it('flags produce peaking next month', () => {
    expect(comingSoon('butternut-squash', '2026-08-15')).toBe(true);
    expect(comingSoon('butternut-squash', '2026-10-15')).toBe(false);
  });

  it('ranks recipes by how much of the dish is seasonal', () => {
    const picks = seasonalPicks({ recipes: TEST_RECIPES, date: SPRING });
    expect(picks.length).toBeGreaterThan(0);
    expect(picks[0].peaking.length).toBeGreaterThan(0);
    // sorted, and never repeats an ingredient inside one pick
    for (let i = 1; i < picks.length; i++) expect(picks[i - 1].score).toBeGreaterThanOrEqual(picks[i].score);
    for (const p of picks) expect(new Set(p.peaking).size).toBe(p.peaking.length);
  });

  it('honours exclude and limit', () => {
    const all = seasonalPicks({ recipes: TEST_RECIPES, date: SPRING });
    const fewer = seasonalPicks({ recipes: TEST_RECIPES, date: SPRING, exclude: new Set([all[0].recipe.id]) });
    expect(fewer.map((p) => p.recipe.id)).not.toContain(all[0].recipe.id);
    expect(seasonalPicks({ recipes: TEST_RECIPES, date: SPRING, limit: 1 })).toHaveLength(1);
    expect(seasonalPicks({ recipes: TEST_RECIPES, date: '2026-01-15' })).toEqual([]);
  });
});

describe('leftovers', () => {
  it('spaces leftover nights out rather than stacking them', () => {
    const slots = leftoverSlots({ from: TODAY, slot: 'dinner', nights: 2, meals: [] });
    expect(slots).toHaveLength(2);
    expect(slots[0].daysAfter).toBeGreaterThanOrEqual(2);
    expect(slots[1].daysAfter - slots[0].daysAfter).toBeGreaterThan(1);
  });

  it('skips nights that already have a meal', () => {
    const busy = ['2026-07-16', '2026-07-17', '2026-07-18'].map((d) => meal('test-tacos', d));
    const slots = leftoverSlots({ from: TODAY, slot: 'dinner', nights: 1, meals: busy });
    expect(busy.map((m) => m.date)).not.toContain(slots[0].date);
  });

  it('sends far-off nights to the freezer', () => {
    const slots = leftoverSlots({ from: TODAY, slot: 'dinner', nights: 4, meals: [] });
    for (const s of slots) expect(s.storage).toBe(s.daysAfter <= 4 ? 'fridge' : 'freezer');
  });

  it('asks for nothing when nights is zero or negative', () => {
    expect(leftoverSlots({ from: TODAY, slot: 'dinner', nights: 0, meals: [] })).toEqual([]);
    expect(leftoverSlots({ from: TODAY, slot: 'dinner', nights: -2, meals: [] })).toEqual([]);
  });

  it('scales servings for the extra nights', () => {
    expect(batchServings(4, 0)).toBe(4);
    expect(batchServings(4, 2)).toBe(12);
    expect(batchServings(4, -1)).toBe(4);
  });

  it('parses only well-formed freezer entries', () => {
    expect(parseFreezer(undefined)).toEqual([]);
    expect(parseFreezer('nope')).toEqual([]);
    expect(parseFreezer([{ id: 'a' }, null, 7])).toEqual([]);
  });

  const frozen = (id: string, eatBy: string, portions = 2): FreezerMeal =>
    ({ id, recipeId: 'test-curry', portions, servingsEach: 4, frozenAt: NOW, eatBy });

  it('takes one portion at a time and drops the entry at zero', () => {
    const list = [frozen('a', '2026-10-01', 2)];
    const once = takePortion(list, 'a');
    expect(once[0].portions).toBe(1);
    expect(takePortion(once, 'a')).toEqual([]);
    expect(takePortion(list, 'missing')).toEqual(list);
  });

  it('warns about portions coming up on their date', () => {
    const list = [frozen('soon', '2026-07-20'), frozen('later', '2026-12-01')];
    expect(freezerExpiring(list, TODAY).map((m) => m.id)).toEqual(['soon']);
    expect(freezerExpiring(list, TODAY, 200).map((m) => m.id)).toEqual(['soon', 'later']);
  });

  it('keeps things for three months', () => {
    expect(FREEZER_DAYS).toBe(90);
  });
});

describe('week balance', () => {
  const week = (ids: string[]) => ids.map((id, i) => meal(id, `2026-07-${13 + i}`));
  const opts = { recipeById: recipesById, ingById };

  it('rewards a varied week', () => {
    const varied = weekBalance({ meals: week(['test-tacos', 'test-curry', 'test-chicken', 'test-shakshuka', 'test-bean-bowl']), ...opts });
    const samey = weekBalance({ meals: week(['test-tacos', 'test-pasta', 'test-tacos', 'test-pasta', 'test-tacos']), ...opts });
    expect(varied.score).toBeGreaterThan(samey.score);
    expect(varied.meals).toBe(5);
  });

  it('names the repeat', () => {
    const b = weekBalance({ meals: week(['test-tacos', 'test-tacos', 'test-curry']), ...opts });
    expect(b.repeats[0]).toMatchObject({ recipeId: 'test-tacos', count: 2 });
    expect(b.notes.some((n) => n.tone === 'warn')).toBe(true);
  });

  it('ignores skipped meals and leftovers', () => {
    const meals = [
      meal('test-tacos', '2026-07-13'),
      meal('test-curry', '2026-07-14', { status: 'skipped' }),
      meal('test-tacos', '2026-07-15', { leftoverOf: 'x' }),
    ];
    expect(weekBalance({ meals, ...opts }).meals).toBe(1);
  });

  it('scores an empty week without blowing up', () => {
    const b = weekBalance({ meals: [], ...opts });
    expect(b.meals).toBe(0);
    expect(b.score).toBeGreaterThanOrEqual(0);
    expect(b.score).toBeLessThanOrEqual(100);
  });
});

describe('smart collections', () => {
  const ctx: SmartContext = {
    date: TODAY,
    lastCookedAt: new Map([['test-tacos', NOW - 5 * DAY], ['test-pasta', NOW - 200 * DAY]]),
    coverage: new Map([['test-tacos', 1], ['test-curry', 0.2]]),
    weeknightMaxMin: 45,
    now: NOW,
  };

  it('has a unique id and a blurb for every shelf', () => {
    expect(new Set(SMART_COLLECTIONS.map((c) => c.id)).size).toBe(SMART_COLLECTIONS.length);
    for (const c of SMART_COLLECTIONS) expect(c.blurb.length).toBeGreaterThan(10);
  });

  it('looks a shelf up by id', () => {
    expect(smartById('smart:quick')?.name).toBe('Under 30 minutes');
    expect(smartById('nope')).toBeUndefined();
  });

  it('puts a well-stocked weeknight recipe in "cook tonight"', () => {
    const members = smartMembers(smartById('smart:tonight')!, TEST_RECIPES, ctx);
    expect(members.map((r) => r.id)).toContain('test-tacos');
    expect(members.map((r) => r.id)).not.toContain('test-curry');
  });

  it('finds the long-neglected and the never-cooked', () => {
    expect(smartMembers(smartById('smart:neglected')!, TEST_RECIPES, ctx).map((r) => r.id)).toEqual(['test-pasta']);
    const untried = smartMembers(smartById('smart:untried')!, TEST_RECIPES, ctx).map((r) => r.id);
    expect(untried).not.toContain('test-tacos');
    expect(untried).toContain('test-curry');
  });

  it('counts every shelf in one pass, matching the members', () => {
    const counts = smartCounts(TEST_RECIPES, ctx);
    for (const c of SMART_COLLECTIONS) expect(counts.get(c.id)).toBe(smartMembers(c, TEST_RECIPES, ctx).length);
  });

  it('never shows archived recipes', () => {
    const archived = TEST_RECIPES.map((r) => ({ ...r, archived: true }));
    for (const c of SMART_COLLECTIONS) expect(smartMembers(c, archived, ctx)).toEqual([]);
  });
});

describe('dinner timeline', () => {
  it('reads and writes clock times', () => {
    expect(parseClock('18:30')).toBe(1110);
    expect(formatClock(1110)).toBe('6:30 PM');
    expect(formatClock(0)).toBe('12:00 AM');
    expect(formatClock(720)).toBe('12:00 PM');
  });

  it('starts the longest dish first and lands everything together', () => {
    const dishes = ['test-pasta', 'test-salmon'].map((id) => recipesById.get(id)!);
    const t = buildTimeline(dishes, parseClock('18:00'));
    expect(t.dishes[0].recipeId).toBe('test-pasta');
    expect(t.startAt).toBe(1080 - 35);
    expect(t.events[t.events.length - 1].kind).toBe('serve');
    for (const d of t.dishes) expect(d.startAt + d.prepMin + d.cookMin).toBe(t.serveAt);
  });

  it('spots two dishes that both want your hands', () => {
    const dishes = ['test-curry', 'test-shakshuka'].map((id) => recipesById.get(id)!);
    const t = buildTimeline(dishes, parseClock('18:00'));
    expect(t.conflicts.length).toBe(1);
    expect(t.conflicts[0].titles).toHaveLength(2);
  });

  it('handles a single dish with no conflicts', () => {
    const t = buildTimeline([recipesById.get('test-tacos')!], parseClock('12:00'));
    expect(t.conflicts).toEqual([]);
    expect(t.events.filter((e) => e.kind === 'cook')).toHaveLength(1);
  });
});

describe('store plan', () => {
  const assignment: StoreAssignment = {
    aisles: { produce: 'aldi', meat: 'kroger' },
    overrides: { 'ground-turkey': 'walmart' },
    primary: 'walmart',
  };

  it('prefers an item override over the aisle rule', () => {
    expect(storeFor(assignment, { ingredientId: 'ground-turkey', aisle: 'meat' })).toBe('walmart');
    expect(storeFor(assignment, { ingredientId: 'chicken-thighs', aisle: 'meat' })).toBe('kroger');
    expect(storeFor(assignment, { aisle: 'spices' })).toBe('walmart');
  });

  it('groups lines with the primary store first', () => {
    const lines = [
      { ingredientId: 'tomato', aisle: 'produce' as const },
      { ingredientId: 'chicken-thighs', aisle: 'meat' as const },
      { ingredientId: 'olive-oil', aisle: 'oils-condiments' as const },
    ];
    const groups = groupByStore(lines, assignment);
    expect(groups[0].store).toBe('walmart');
    expect(groups.map((g) => g.store).sort()).toEqual(['aldi', 'kroger', 'walmart']);
    expect(storeStops(groups)).toBe(3);
    expect(groups.reduce((n, g) => n + g.lines.length, 0)).toBe(3);
  });

  it('collapses to one stop when nothing is assigned away', () => {
    const plain: StoreAssignment = { aisles: {}, overrides: {}, primary: 'target' };
    const groups = groupByStore([{ aisle: 'produce' as const }, { aisle: 'meat' as const }], plain);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Target');
  });
});

describe('recently viewed', () => {
  it('puts the newest first and never repeats', () => {
    expect(pushRecent(['a', 'b'], 'b')).toEqual(['b', 'a']);
    expect(pushRecent([], 'a')).toEqual(['a']);
  });

  it('caps the list', () => {
    let list: string[] = [];
    for (let i = 0; i < 30; i++) list = pushRecent(list, `r${i}`);
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0]).toBe('r29');
  });

  it('ignores junk out of storage', () => {
    expect(parseRecent(undefined)).toEqual([]);
    expect(parseRecent(['a', 5, null])).toEqual(['a']);
  });
});

describe('menu card', () => {
  const meals = [
    meal('test-tacos', '2026-07-13'),
    meal('test-curry', '2026-07-14', { leftoverOf: 'x' }),
    meal('test-pasta', '2026-07-15', { status: 'skipped' }),
  ];

  it('lays the week out day by day', () => {
    const card = buildMenuCard({ from: '2026-07-13', to: '2026-07-19', meals, recipeById: recipesById });
    expect(card.days).toHaveLength(7);
    expect(card.days[0].label).toBe('Monday');
    expect(card.days[0].entries[0].title).toBe('Turkey Tacos');
    expect(card.days[1].entries[0].note).toBe('leftovers');
    expect(card.days[2].entries[0].skipped).toBe(true);
    expect(card.days[6].entries).toEqual([]);
  });

  it('writes a short text version that leaves out skipped nights', () => {
    const text = menuCardText(buildMenuCard({ from: '2026-07-13', to: '2026-07-19', meals, recipeById: recipesById }));
    expect(text).toContain('Turkey Tacos');
    expect(text).not.toContain('Turkey Pasta');
    expect(text.split('\n')[0]).toContain('Dinner');
  });
});

describe('expiry calendar', () => {
  const lots = [
    lot('tomato', 400, { expiresOn: '2026-07-10' }),
    lot('chicken-thighs', 900, { expiresOn: '2026-07-17' }),
    lot('spinach', 200, { expiresOn: '2026-09-30' }),
    lot('white-rice', 900),
    lot('feta', 100, { qty: 0, expiresOn: '2026-07-16' }),
  ];
  const calendar = expiryCalendar({ lots, ingById, today: TODAY });

  it('splits overdue, this-window and later', () => {
    expect(calendar.overdue.map((i) => i.ingredientId)).toEqual(['tomato']);
    expect(calendar.days).toHaveLength(22);
    expect(calendar.days.flatMap((d) => d.items).map((i) => i.ingredientId)).toEqual(['chicken-thighs']);
    expect(calendar.laterCount).toBe(1);
  });

  it('counts undated stock rather than hiding it', () => {
    expect(calendar.undatedCount).toBe(1);
  });

  it('ignores empty lots', () => {
    expect([...calendar.overdue, ...calendar.days.flatMap((d) => d.items)].map((i) => i.ingredientId)).not.toContain('feta');
  });

  it('suggests recipes that use the urgent things', () => {
    const rescue = rescueRecipes({ calendar, recipes: TEST_RECIPES });
    expect(rescue.length).toBeGreaterThan(0);
    expect(rescue[0].uses.length).toBeGreaterThan(0);
    for (let i = 1; i < rescue.length; i++) expect(rescue[i - 1].uses.length).toBeGreaterThanOrEqual(rescue[i].uses.length);
  });

  it('suggests nothing when nothing is urgent', () => {
    const calm = expiryCalendar({ lots: [lot('white-rice', 900)], ingById, today: TODAY });
    expect(rescueRecipes({ calendar: calm, recipes: TEST_RECIPES })).toEqual([]);
  });
});
