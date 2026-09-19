// The week as a menu, not as a planner: one page you can print and stick on the fridge so the
// rest of the household stops asking what's for dinner.
import { formatDay, rangeDays } from './dates';
import type { ISODate, PlannedMeal, Recipe, Slot } from './types';

export interface MenuEntry {
  title: string;
  slot: Slot;
  /** "leftovers", "30 min", and so on — a short right-hand note. */
  note: string;
  skipped: boolean;
}

export interface MenuDay {
  date: ISODate;
  label: string;
  entries: MenuEntry[];
}

export interface MenuCard {
  from: ISODate;
  to: ISODate;
  heading: string;
  days: MenuDay[];
}

const SLOT_ORDER: Record<Slot, number> = { breakfast: 0, lunch: 1, dinner: 2 };

export function buildMenuCard(input: {
  from: ISODate;
  to: ISODate;
  meals: PlannedMeal[];
  recipeById: Map<string, Recipe>;
  /** Sides are folded into the main's line rather than given their own row. */
  includeSides?: boolean;
}): MenuCard {
  const days = rangeDays(input.from, input.to).map((date) => {
    const entries = input.meals
      .filter((m) => m.date === date)
      .sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot])
      .flatMap<MenuEntry>((m) => {
        const r = input.recipeById.get(m.recipeId);
        if (!r) return [];
        if (r.role === 'side' && input.includeSides === false) return [];
        const mins = r.prepMin + r.cookMin;
        return [{
          title: r.title,
          slot: m.slot,
          note: m.leftoverOf ? 'leftovers' : r.role === 'side' ? 'side' : `${mins} min`,
          skipped: m.status === 'skipped',
        }];
      });
    return { date, label: formatDay(date, 'EEEE'), entries };
  });

  return {
    from: input.from,
    to: input.to,
    heading: `${formatDay(input.from, 'MMMM d')} – ${formatDay(input.to, 'MMMM d')}`,
    days,
  };
}

/** Plain text of the same card, for pasting into a message. */
export function menuCardText(card: MenuCard): string {
  const lines = [`Dinner, ${card.heading}`, ''];
  for (const day of card.days) {
    if (!day.entries.length) continue;
    lines.push(`${day.label}: ${day.entries.filter((e) => !e.skipped).map((e) => e.title).join(' + ') || '—'}`);
  }
  return lines.join('\n');
}
