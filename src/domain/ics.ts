// Calendar (.ics) reminders. iPhone web apps can't schedule notifications for later,
// but Calendar can: export thaw / cook / use-by / shopping reminders with alarms.
import { addDaysISO, daysBetween, nextShoppingDay } from './dates';
import { thawNeeds } from './freshness';
import type { Ingredient, ISODate, LooseStock, PlannedMeal, Recipe, Slot, StockLot } from './types';

export interface CalEvent {
  uid: string;
  date: ISODate;
  time: string; // 'HH:MM' local
  minutes: number;
  title: string;
  description?: string;
  alarmMin?: number; // minutes before start
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
const pad = (n: number) => String(n).padStart(2, '0');

function localStamp(date: ISODate, time: string, plusMin = 0): string {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mm] = time.split(':').map(Number);
  const t = new Date(y, m - 1, d, h, mm + plusMin);
  return `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}T${pad(t.getHours())}${pad(t.getMinutes())}00`;
}

/** Fold long lines at 75 octets-ish, per RFC 5545. */
const fold = (line: string) => line.match(/.{1,73}/g)!.join('\r\n ');

export function buildICS(events: CalEvent[], now: number): string {
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Meal Planner//Reminders//EN', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@meal-planner`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${localStamp(e.date, e.time)}`,
      `DTEND:${localStamp(e.date, e.time, e.minutes)}`,
      `SUMMARY:${esc(e.title)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.alarmMin !== undefined) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${e.alarmMin}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

const COOK_TIME: Record<Slot, string> = { breakfast: '07:30', lunch: '11:30', dinner: '17:00' };

export function reminderEvents(input: {
  meals: PlannedMeal[];
  recipesById: Map<string, Recipe>;
  ingById: Map<string, Ingredient>;
  lots: StockLot[];
  loose: LooseStock[];
  today: ISODate;
  shoppingDay: number;
  days?: number;
}): CalEvent[] {
  const { today, recipesById, ingById } = input;
  const end = addDaysISO(today, input.days ?? 7);
  const events: CalEvent[] = [];

  for (const t of thawNeeds({ ...input, horizonDays: input.days ?? 7 })) {
    const recipe = recipesById.get(t.recipeId);
    const sameDay = t.thawBy === t.date;
    events.push({
      uid: `thaw-${t.lot.id}-${t.date}`,
      date: t.thawBy,
      time: sameDay ? '08:00' : '20:00',
      minutes: 15,
      title: `🧊 Thaw ${t.ing.name.toLowerCase()}`,
      description: `For ${recipe?.title ?? 'a planned meal'} on ${t.date}. ${t.ing.thawTip ?? 'Move it from the freezer to the fridge.'}`,
      alarmMin: 0,
    });
  }

  for (const m of input.meals) {
    if (m.status !== 'planned' || m.leftoverOf || m.date < today || m.date > end) continue;
    const r = recipesById.get(m.recipeId);
    if (!r) continue;
    events.push({
      uid: `cook-${m.id}`,
      date: m.date,
      time: COOK_TIME[m.slot],
      minutes: Math.max(15, r.prepMin + r.cookMin),
      title: `🍳 ${r.title}`,
      description: `${m.servings} servings · ${r.prepMin + r.cookMin} min.`,
      alarmMin: 30,
    });
  }

  for (const lot of input.lots) {
    const ing = ingById.get(lot.ingredientId);
    if (!ing || !lot.expiresOn || lot.location === 'freezer') continue;
    const n = daysBetween(today, lot.expiresOn);
    if (n < 1 || n > (input.days ?? 7)) continue;
    events.push({
      uid: `use-${lot.id}`,
      date: addDaysISO(lot.expiresOn, -1),
      time: '10:00',
      minutes: 15,
      title: `⏰ Use your ${ing.name.toLowerCase()} by tomorrow`,
      description: ing.shelfLife.freezer ? "Can't use it in time? Freeze it today." : undefined,
      alarmMin: 0,
    });
  }

  const shop = nextShoppingDay(today, input.shoppingDay);
  if (shop <= end) {
    events.push({ uid: `shop-${shop}`, date: shop, time: '09:00', minutes: 60, title: '🛒 Shopping day', description: 'Open Meal Planner for your list.', alarmMin: 0 });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}
