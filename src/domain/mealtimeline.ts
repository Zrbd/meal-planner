// Working backwards from when you want to eat. Two dishes and a side is three sets of
// instructions that all say "meanwhile"; this turns them into one clock.
import type { Recipe } from './types';

/** Minutes past local midnight. */
export type Minutes = number;

export const parseClock = (hhmm: string): Minutes => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return 18 * 60;
  return Math.min(24 * 60 - 1, Math.max(0, Number(m[1]) * 60 + Number(m[2])));
};

export function formatClock(mins: Minutes): string {
  const wrapped = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h24 = Math.floor(wrapped / 60);
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(wrapped % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

export interface TimelineEvent {
  at: Minutes;
  recipeId: string;
  title: string;
  kind: 'prep' | 'cook' | 'serve';
  text: string;
}

export interface TimelineDish {
  recipeId: string;
  title: string;
  startAt: Minutes;
  prepMin: number;
  cookMin: number;
}

export interface Timeline {
  serveAt: Minutes;
  startAt: Minutes;
  dishes: TimelineDish[];
  events: TimelineEvent[];
  /** Stretches where two dishes both want your hands. */
  conflicts: { at: Minutes; titles: string[] }[];
}

/**
 * Schedule every dish to finish at the same moment. Longest dish starts first; each one's
 * hands-on prep sits immediately before its cook time, which is how people actually work —
 * chop the thing, then put the thing on.
 */
export function buildTimeline(recipes: Recipe[], serveAt: Minutes): Timeline {
  const dishes: TimelineDish[] = recipes
    .map((r) => ({
      recipeId: r.id,
      title: r.title,
      prepMin: Math.max(0, r.prepMin),
      cookMin: Math.max(0, r.cookMin),
      startAt: serveAt - Math.max(1, r.prepMin + r.cookMin),
    }))
    .sort((a, b) => a.startAt - b.startAt);

  const events: TimelineEvent[] = [];
  for (const d of dishes) {
    events.push({
      at: d.startAt, recipeId: d.recipeId, title: d.title, kind: 'prep',
      text: d.prepMin > 0 ? `Start prepping ${d.title} (${d.prepMin} min)` : `Start ${d.title}`,
    });
    if (d.prepMin > 0 && d.cookMin > 0) {
      events.push({
        at: d.startAt + d.prepMin, recipeId: d.recipeId, title: d.title, kind: 'cook',
        text: `${d.title} on the heat (${d.cookMin} min)`,
      });
    }
  }
  events.push({ at: serveAt, recipeId: '', title: '', kind: 'serve', text: 'Everything is ready — serve.' });
  events.sort((a, b) => a.at - b.at || a.title.localeCompare(b.title));

  // Two prep windows that overlap mean you cannot be in both places.
  const conflicts: { at: Minutes; titles: string[] }[] = [];
  const preps = dishes.filter((d) => d.prepMin > 0);
  for (let i = 0; i < preps.length; i++) {
    for (let j = i + 1; j < preps.length; j++) {
      const a = preps[i];
      const b = preps[j];
      const from = Math.max(a.startAt, b.startAt);
      const to = Math.min(a.startAt + a.prepMin, b.startAt + b.prepMin);
      if (to - from >= 5) conflicts.push({ at: from, titles: [a.title, b.title] });
    }
  }

  return {
    serveAt,
    startAt: dishes.length ? dishes[0].startAt : serveAt,
    dishes,
    events,
    conflicts: conflicts.sort((a, b) => a.at - b.at),
  };
}
