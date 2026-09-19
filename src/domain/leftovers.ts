// Cook once, eat three times: where the extra portions go, and what happens to the ones
// that will not get eaten in time.
import { addDaysISO, daysBetween } from './dates';
import type { ISODate, PlannedMeal, Slot } from './types';

/** How long a cooked dish is worth keeping in the fridge. */
export const FRIDGE_DAYS = 4;

export interface LeftoverSlot {
  date: ISODate;
  slot: Slot;
  /** Nights after the cook date. */
  daysAfter: number;
  storage: 'fridge' | 'freezer';
}

/**
 * Free nights to put leftovers on, nearest first. Skips anything already planned in that slot
 * and never lands two leftover nights back to back unless it has to — eating the same dish on
 * consecutive days is the fastest way to stop wanting it.
 */
export function leftoverSlots(input: {
  from: ISODate;
  slot: Slot;
  nights: number;
  meals: PlannedMeal[];
  horizonDays?: number;
  fridgeDays?: number;
}): LeftoverSlot[] {
  const horizon = input.horizonDays ?? 10;
  const fridgeDays = input.fridgeDays ?? FRIDGE_DAYS;
  const taken = new Set(
    input.meals.filter((m) => m.status !== 'skipped').map((m) => `${m.date}:${m.slot}`),
  );
  const free: ISODate[] = [];
  for (let i = 1; i <= horizon; i++) {
    const date = addDaysISO(input.from, i);
    if (!taken.has(`${date}:${input.slot}`)) free.push(date);
  }

  // Prefer every-other-night, then fall back to filling the gaps.
  const spaced = free.filter((_, i) => i % 2 === 1);
  const ordered = [...spaced, ...free.filter((d) => !spaced.includes(d))];
  return ordered.slice(0, Math.max(0, input.nights)).sort().map((date) => {
    const daysAfter = daysBetween(input.from, date);
    return { date, slot: input.slot, daysAfter, storage: daysAfter <= fridgeDays ? 'fridge' : 'freezer' };
  });
}

/** Servings to cook so that `nights + 1` meals each feed `perMeal` people. */
export const batchServings = (perMeal: number, extraNights: number): number => perMeal * (1 + Math.max(0, extraNights));

// ---------- freezer meals ----------

/** A portion of something already cooked, sitting in the freezer. */
export interface FreezerMeal {
  id: string;
  recipeId: string;
  /** How many meals' worth, not how many people. */
  portions: number;
  servingsEach: number;
  frozenAt: number;
  /** Best-by; frozen food is safe far longer but stops being nice to eat. */
  eatBy: ISODate;
  note?: string;
}

/** Frozen cooked food keeps its texture for about this long. */
export const FREEZER_DAYS = 90;

export function parseFreezer(value: unknown): FreezerMeal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const m = raw as Partial<FreezerMeal>;
    if (typeof m?.id !== 'string' || typeof m.recipeId !== 'string') return [];
    return [{
      id: m.id,
      recipeId: m.recipeId,
      portions: Math.max(1, Math.round(Number(m.portions) || 1)),
      servingsEach: Math.max(1, Number(m.servingsEach) || 1),
      frozenAt: Number(m.frozenAt) || 0,
      eatBy: typeof m.eatBy === 'string' ? m.eatBy : '',
      note: typeof m.note === 'string' ? m.note : undefined,
    }];
  });
}

export const freezerExpiring = (list: FreezerMeal[], today: ISODate, withinDays = 14): FreezerMeal[] =>
  list.filter((m) => m.eatBy && daysBetween(today, m.eatBy) <= withinDays).sort((a, b) => a.eatBy.localeCompare(b.eatBy));

/** Take one portion out. Returns the list with that meal decremented, or dropped when it was the last. */
export function takePortion(list: FreezerMeal[], id: string): FreezerMeal[] {
  return list.flatMap((m) => {
    if (m.id !== id) return [m];
    return m.portions > 1 ? [{ ...m, portions: m.portions - 1 }] : [];
  });
}
