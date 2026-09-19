// Grocery budget: how much of this week's allowance is already spent.
import { addDaysISO, toISODate } from './dates';
import type { ISODate, Trip } from './types';

export interface BudgetStatus {
  budget: number;
  spent: number;
  /** Estimated cost of the list you have not bought yet. */
  pending: number;
  left: number;
  /** 0..1+ — over 1 means the week is already over budget. */
  ratio: number;
  over: boolean;
  /** Over once the current list is paid for, even though it isn't yet. */
  wouldBeOver: boolean;
  /** Start of the 7-day window the numbers cover. */
  from: ISODate;
}

/** Spending in the 7 days ending today, measured against the weekly budget. */
export function budgetStatus(input: {
  trips: Trip[];
  today: ISODate;
  budget: number;
  pending?: number;
}): BudgetStatus | null {
  if (!input.budget || input.budget <= 0) return null;
  const from = addDaysISO(input.today, -6);
  let spent = 0;
  for (const t of input.trips) {
    const day = toISODate(new Date(t.finishedAt));
    if (day < from || day > input.today) continue;
    spent += t.lines.reduce((s, l) => s + (l.price ?? 0), 0);
  }
  const pending = Math.max(0, input.pending ?? 0);
  return {
    budget: input.budget,
    spent,
    pending,
    left: input.budget - spent,
    ratio: spent / input.budget,
    over: spent > input.budget,
    wouldBeOver: spent + pending > input.budget,
    from,
  };
}
