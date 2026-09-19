// Everything in the house with a date on it, laid out day by day. The alerts on Home tell you
// what is urgent today; this answers the other question — what is the shape of the next
// three weeks, and which night should I plan around that chicken.
import { addDaysISO, daysBetween, rangeDays } from './dates';
import type { Ingredient, ISODate, Recipe, StockLot } from './types';

export interface ExpiryItem {
  lotId: string;
  ingredientId: string;
  name: string;
  qty: number;
  location: StockLot['location'];
  expiresOn: ISODate;
  daysLeft: number;
}

export interface ExpiryDay {
  date: ISODate;
  items: ExpiryItem[];
}

export interface ExpiryCalendar {
  /** Already past their date — shown above the calendar, not inside it. */
  overdue: ExpiryItem[];
  days: ExpiryDay[];
  /** Dated stock beyond the window, counted but not listed. */
  laterCount: number;
  /** Stock with no date at all; tracked so the screen can say so rather than look empty. */
  undatedCount: number;
}

export function expiryCalendar(input: {
  lots: StockLot[];
  ingById: Map<string, Ingredient>;
  today: ISODate;
  /** How many days forward to lay out. Defaults to three weeks. */
  days?: number;
}): ExpiryCalendar {
  const span = input.days ?? 21;
  const byDate = new Map<ISODate, ExpiryItem[]>();
  const overdue: ExpiryItem[] = [];
  let laterCount = 0;
  let undatedCount = 0;

  for (const lot of input.lots) {
    if (lot.qty <= 0) continue;
    if (!lot.expiresOn) {
      undatedCount++;
      continue;
    }
    const daysLeft = daysBetween(input.today, lot.expiresOn);
    const item: ExpiryItem = {
      lotId: lot.id,
      ingredientId: lot.ingredientId,
      name: input.ingById.get(lot.ingredientId)?.name ?? lot.ingredientId,
      qty: lot.qty,
      location: lot.location,
      expiresOn: lot.expiresOn,
      daysLeft,
    };
    if (daysLeft < 0) overdue.push(item);
    else if (daysLeft > span) laterCount++;
    else {
      const bucket = byDate.get(lot.expiresOn);
      if (bucket) bucket.push(item);
      else byDate.set(lot.expiresOn, [item]);
    }
  }

  const window = rangeDays(input.today, addDaysISO(input.today, span));
  return {
    overdue: overdue.sort((a, b) => a.expiresOn.localeCompare(b.expiresOn)),
    days: window.map((date) => ({ date, items: (byDate.get(date) ?? []).sort((a, b) => a.name.localeCompare(b.name)) })),
    laterCount,
    undatedCount,
  };
}


/** Recipes that would use up something expiring soon, best match first. */
export function rescueRecipes(input: {
  calendar: ExpiryCalendar;
  recipes: Recipe[];
  withinDays?: number;
  limit?: number;
}): { recipe: Recipe; uses: string[] }[] {
  const within = input.withinDays ?? 4;
  const urgent = new Map<string, string>();
  for (const item of input.calendar.overdue) urgent.set(item.ingredientId, item.name);
  for (const day of input.calendar.days) {
    for (const item of day.items) if (item.daysLeft <= within) urgent.set(item.ingredientId, item.name);
  }
  if (!urgent.size) return [];
  return input.recipes
    .filter((r) => !r.archived)
    .map((r) => ({ recipe: r, uses: [...new Set(r.ingredients.filter((ri) => urgent.has(ri.ingredientId)).map((ri) => urgent.get(ri.ingredientId)!))] }))
    .filter((x) => x.uses.length > 0)
    .sort((a, b) => b.uses.length - a.uses.length || a.recipe.title.localeCompare(b.recipe.title))
    .slice(0, input.limit ?? 8);
}
