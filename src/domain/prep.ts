// Prep ahead: steps that need waiting time before you cook (marinate, soak, rise, chill, rest),
// when to start them for planned meals, and a timeline that also includes thawing.
import { addDaysISO } from './dates';
import { thawNeeds } from './freshness';
import type { Ingredient, ISODate, LooseStock, PlannedMeal, Recipe, Slot, StockLot } from './types';

/** When cooking starts for each meal slot. */
export const COOK_TIME: Record<Slot, string> = { breakfast: '07:30', lunch: '11:30', dinner: '17:00' };

export type PrepKind = 'marinate' | 'soak' | 'rise' | 'chill' | 'rest';

export interface PrepStep {
  kind: PrepKind;
  minutes: number;
  stepIndex: number;
  /** Ingredient the step is about, when the step names one. */
  what?: string;
}

const KINDS: [PrepKind, RegExp][] = [
  ['marinate', /\bmarinat(e|es|ed|ing)\b|\bin the marinade\b/i],
  ['soak', /\bsoak(s|ed|ing)?\b/i],
  ['rise', /\b(rise|proof|double[sd]? in size)\b/i],
  ['chill', /\b(chill|refrigerate|freeze until firm|in the fridge)\b/i],
  ['rest', /\b(rest|let (it |them )?(sit|stand))\b/i],
];

const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8, twelve: 12 };
const DURATION = /\b(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|eight|twelve)(?:\s*(?:-|–|to|or)\s*\d+(?:\.\d+)?)?\s*(hours?|hrs?|minutes?|mins?)\b/gi;

/** Waiting time mentioned in a step, in minutes (a range counts its low end; "overnight" is 8 hours). */
export function stepMinutes(step: string): number {
  if (/\bovernight\b/i.test(step)) return 8 * 60;
  let best = 0;
  for (const m of step.matchAll(DURATION)) {
    const n = WORDS[m[1].toLowerCase()] ?? Number(m[1]);
    best = Math.max(best, /^h/i.test(m[2]) ? n * 60 : n);
  }
  return best;
}

/** Steps with real waiting time (15+ minutes). */
export function prepSteps(recipe: Recipe, ingById?: Map<string, Ingredient>): PrepStep[] {
  const out: PrepStep[] = [];
  recipe.steps.forEach((step, stepIndex) => {
    const kind = KINDS.find(([, re]) => re.test(step))?.[0];
    if (!kind) return;
    const minutes = stepMinutes(step);
    if (minutes < 15) return;
    const lower = step.toLowerCase();
    const what = ingById && recipe.ingredients
      .map((ri) => ingById.get(ri.ingredientId))
      .find((ing) => ing && !ing.alwaysOnHand && lower.includes(ing.name.toLowerCase()))?.name.toLowerCase();
    out.push({ kind, minutes, stepIndex, what });
  });
  return out;
}

export interface PrepTask extends PrepStep {
  id: string;
  mealId: string;
  recipeId: string;
  date: ISODate;
  slot: Slot;
  /** Local time to start, as epoch ms. */
  startAt: number;
  /** When cooking starts. */
  cookAt: number;
}

export const localMs = (date: ISODate, time: string, plusMin = 0): number => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, mm + plusMin).getTime();
};

/** Prep steps for planned meals from today through `horizonDays` ahead. */
export function prepTasks(input: {
  meals: PlannedMeal[];
  recipesById: Map<string, Recipe>;
  ingById?: Map<string, Ingredient>;
  today: ISODate;
  horizonDays?: number;
}): PrepTask[] {
  const end = addDaysISO(input.today, input.horizonDays ?? 2);
  const out: PrepTask[] = [];
  for (const m of input.meals) {
    if (m.status !== 'planned' || m.leftoverOf || m.date < input.today || m.date > end) continue;
    const r = input.recipesById.get(m.recipeId);
    if (!r) continue;
    const cookAt = localMs(m.date, COOK_TIME[m.slot]);
    for (const s of prepSteps(r, input.ingById)) {
      out.push({ ...s, id: `${m.id}:${s.stepIndex}`, mealId: m.id, recipeId: r.id, date: m.date, slot: m.slot, cookAt, startAt: cookAt - s.minutes * 60_000 });
    }
  }
  return out.sort((a, b) => a.startAt - b.startAt);
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hr${h === 1 ? '' : 's'}`;
}

export function formatClock(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const VERB: Record<PrepKind, (what?: string) => string> = {
  marinate: (w) => `Marinate the ${w ?? 'meat'}`,
  soak: (w) => `Soak the ${w ?? 'beans'}`,
  rise: () => 'Let the dough rise',
  chill: (w) => (w ? `Chill the ${w}` : 'Chill it'),
  rest: (w) => (w ? `Let the ${w} rest` : 'Let it rest'),
};

export const prepTitle = (t: PrepStep) => VERB[t.kind](t.what);

export interface TimelineItem {
  id: string;
  kind: PrepKind | 'thaw';
  at: number;
  date: ISODate;
  title: string;
  /** How long it takes, e.g. "4 hrs" or "overnight in the fridge". */
  duration: string;
  recipeId: string;
  ingredientId?: string;
  /** When cooking starts; the item is moot after this. */
  cookAt: number;
}

/** Everything to start ahead of cooking in the next couple of days: thawing plus prep steps. */
export function prepTimeline(input: {
  meals: PlannedMeal[];
  recipesById: Map<string, Recipe>;
  ingById: Map<string, Ingredient>;
  lots: StockLot[];
  loose: LooseStock[];
  today: ISODate;
  horizonDays?: number;
}): TimelineItem[] {
  const items: TimelineItem[] = prepTasks(input).map((t) => ({
    id: `prep:${t.id}`, kind: t.kind, at: t.startAt, date: t.date, title: prepTitle(t), duration: formatDuration(t.minutes), recipeId: t.recipeId, cookAt: t.cookAt,
  }));
  for (const t of thawNeeds({ ...input, horizonDays: input.horizonDays ?? 2 })) {
    const sameDay = t.thawBy === t.date;
    items.push({
      id: `thaw:${t.lot.id}`, kind: 'thaw', at: localMs(t.thawBy, sameDay ? '08:00' : '20:00'), date: t.date,
      title: `Thaw the ${t.ing.name.toLowerCase()}`, duration: sameDay ? 'cold-water thaw, about 1–2 hrs' : 'overnight in the fridge',
      recipeId: t.recipeId, ingredientId: t.ing.id, cookAt: localMs(t.date, COOK_TIME[t.slot]),
    });
  }
  return items.sort((a, b) => a.at - b.at);
}
