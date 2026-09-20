// The "cook next" queue. Somewhere between browsing and committing to a date there is a pile of
// "yeah, soon" — this is that pile, ordered, and it feeds the planner's suggestions.
import type { ISODate, PlannedMeal } from './types';

export interface ShortlistEntry {
  recipeId: string;
  addedAt: number;
  /** Why it is on the list: a free note, or a nudge the app wrote ("uses up the cilantro"). */
  note?: string;
}

export const MAX_SHORTLIST = 30;

export function parseShortlist(value: unknown): ShortlistEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: ShortlistEntry[] = [];
  for (const raw of value) {
    const e = raw as Partial<ShortlistEntry>;
    if (typeof e?.recipeId !== 'string' || seen.has(e.recipeId)) continue;
    seen.add(e.recipeId);
    out.push({
      recipeId: e.recipeId,
      addedAt: typeof e.addedAt === 'number' ? e.addedAt : Date.now(),
      note: typeof e.note === 'string' && e.note.trim() ? e.note.trim() : undefined,
    });
  }
  return out.slice(0, MAX_SHORTLIST);
}

/** Newest first, and never past the cap — the oldest "soon" falls off the bottom. */
export function add(list: ShortlistEntry[], recipeId: string, at: number, note?: string): ShortlistEntry[] {
  const without = list.filter((e) => e.recipeId !== recipeId);
  return [{ recipeId, addedAt: at, note }, ...without].slice(0, MAX_SHORTLIST);
}

export function remove(list: ShortlistEntry[], recipeId: string): ShortlistEntry[] {
  return list.filter((e) => e.recipeId !== recipeId);
}

export function has(list: ShortlistEntry[], recipeId: string): boolean {
  return list.some((e) => e.recipeId === recipeId);
}

export function move(list: ShortlistEntry[], from: number, to: number): ShortlistEntry[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

/**
 * Once something is actually on the plan it is no longer "soon"; clear those so the list stays
 * a to-do rather than a second copy of the week.
 */
export function pruneScheduled(list: ShortlistEntry[], meals: PlannedMeal[], today: ISODate): ShortlistEntry[] {
  const scheduled = new Set(meals.filter((m) => m.date >= today && m.status !== 'skipped').map((m) => m.recipeId));
  return list.filter((e) => !scheduled.has(e.recipeId));
}
