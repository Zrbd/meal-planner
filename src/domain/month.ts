// A month at a glance. The week view answers "what's for dinner"; this one answers "have we had
// chicken four times this week" and "which nights are still empty before the holiday".
import { addDaysISO, fromISODate, toISODate, todayISO } from './dates';
import type { ISODate, PlannedMeal, Recipe, Slot } from './types';

export interface MonthCell {
  date: ISODate;
  inMonth: boolean;
  isToday: boolean;
  meals: PlannedMeal[];
  /** Up to three dots for the grid: one per planned meal, colored by protein. */
  dots: { slot: Slot; protein?: string; recipeId: string }[];
}

export interface MonthGrid {
  /** First day of the month being shown. */
  month: ISODate;
  label: string;
  /** Six rows of seven, so the grid never changes height mid-scroll. */
  weeks: MonthCell[][];
  /** Counts for the summary strip under the grid. */
  plannedCount: number;
  emptyDinners: number;
  proteinCounts: Record<string, number>;
}

export const monthStart = (date: ISODate): ISODate => `${date.slice(0, 7)}-01`;

export function shiftMonth(month: ISODate, delta: number): ISODate {
  const d = fromISODate(monthStart(month));
  d.setMonth(d.getMonth() + delta);
  return monthStart(toISODate(d));
}

export function monthGrid(
  month: ISODate,
  meals: PlannedMeal[],
  recipeById: Map<string, Recipe>,
  weekStartsOn: 0 | 1,
  today: ISODate = todayISO(),
): MonthGrid {
  const first = monthStart(month);
  const firstDow = fromISODate(first).getDay();
  const lead = (firstDow - weekStartsOn + 7) % 7;
  const gridStart = addDaysISO(first, -lead);
  const monthKey = first.slice(0, 7);

  const byDate = new Map<ISODate, PlannedMeal[]>();
  for (const m of meals) {
    if (m.status === 'skipped') continue;
    const list = byDate.get(m.date);
    if (list) list.push(m);
    else byDate.set(m.date, [m]);
  }

  const weeks: MonthCell[][] = [];
  let plannedCount = 0;
  let emptyDinners = 0;
  const proteinCounts: Record<string, number> = {};

  for (let w = 0; w < 6; w += 1) {
    const row: MonthCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = addDaysISO(gridStart, w * 7 + d);
      const inMonth = date.slice(0, 7) === monthKey;
      const dayMeals = (byDate.get(date) ?? []).sort((a, b) => a.slot.localeCompare(b.slot));
      if (inMonth) {
        plannedCount += dayMeals.length;
        if (!dayMeals.some((m) => m.slot === 'dinner')) emptyDinners += 1;
        for (const m of dayMeals) {
          const p = recipeById.get(m.recipeId)?.protein;
          if (p) proteinCounts[p] = (proteinCounts[p] ?? 0) + 1;
        }
      }
      row.push({
        date,
        inMonth,
        isToday: date === today,
        meals: dayMeals,
        dots: dayMeals.slice(0, 3).map((m) => ({ slot: m.slot, protein: recipeById.get(m.recipeId)?.protein, recipeId: m.recipeId })),
      });
    }
    weeks.push(row);
  }

  const label = fromISODate(first).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return { month: first, label, weeks, plannedCount, emptyDinners, proteinCounts };
}

/** Weekday headers in the household's week order. */
export function weekdayHeaders(weekStartsOn: 0 | 1): string[] {
  const names = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return weekStartsOn === 1 ? [...names.slice(1), names[0]] : names;
}
