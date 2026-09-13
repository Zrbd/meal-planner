// Local-date helpers. Dates are 'YYYY-MM-DD' strings in LOCAL time.
// Never use `new Date('2026-09-12')` — that parses as UTC and shifts the day.
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns';
import type { ISODate } from './types';

export const toISODate = (d: Date): ISODate => format(d, 'yyyy-MM-dd');
export const todayISO = (): ISODate => toISODate(new Date());
export const fromISODate = (s: ISODate): Date => parseISO(s);
export const addDaysISO = (s: ISODate, n: number): ISODate => toISODate(addDays(parseISO(s), n));
export const daysBetween = (a: ISODate, b: ISODate): number =>
  differenceInCalendarDays(parseISO(b), parseISO(a));
export const startOfWeekISO = (s: ISODate, weekStartsOn: 0 | 1): ISODate =>
  toISODate(startOfWeek(parseISO(s), { weekStartsOn }));
export const weekdayOf = (s: ISODate): number => parseISO(s).getDay();
export const formatDay = (s: ISODate, pattern = 'EEE, MMM d'): string => format(parseISO(s), pattern);

export function rangeDays(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

/** Sun–Thu evenings are "weeknights" (work/school the next day). */
export const isWeeknight = (s: ISODate): boolean => weekdayOf(s) <= 4;

export function nextShoppingDay(today: ISODate, shoppingDay: number): ISODate {
  let d = addDaysISO(today, 1);
  while (weekdayOf(d) !== shoppingDay) d = addDaysISO(d, 1);
  return d;
}

export function relativeDayLabel(s: ISODate, today: ISODate): string {
  const diff = daysBetween(today, s);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDay(s);
}
