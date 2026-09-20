// Saved weeks. Most households rotate through the same four or five weeks forever; this lets you
// keep one, name it, and drop it onto any other week without rebuilding it meal by meal.
import { addDaysISO, daysBetween } from './dates';
import type { ISODate, PlannedMeal, Slot } from './types';

export interface TemplateMeal {
  /** Days after the start of the template week: 0 is the first day. */
  offset: number;
  slot: Slot;
  recipeId: string;
  servings: number;
}

export interface PlanTemplate {
  id: string;
  name: string;
  meals: TemplateMeal[];
  createdAt: number;
  /** Last time it was applied to a week, so the list can sort by what you actually use. */
  usedAt?: number;
}

export function parseTemplates(value: unknown): PlanTemplate[] {
  if (!Array.isArray(value)) return [];
  const out: PlanTemplate[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const t = raw as Partial<PlanTemplate>;
    if (typeof t.id !== 'string' || typeof t.name !== 'string' || !Array.isArray(t.meals)) continue;
    const meals: TemplateMeal[] = [];
    for (const m of t.meals) {
      const mm = m as Partial<TemplateMeal>;
      if (typeof mm?.recipeId !== 'string' || typeof mm.offset !== 'number' || typeof mm.slot !== 'string') continue;
      meals.push({
        offset: Math.max(0, Math.round(mm.offset)),
        slot: mm.slot as Slot,
        recipeId: mm.recipeId,
        servings: typeof mm.servings === 'number' && mm.servings > 0 ? mm.servings : 4,
      });
    }
    out.push({
      id: t.id,
      name: t.name,
      meals,
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
      usedAt: typeof t.usedAt === 'number' ? t.usedAt : undefined,
    });
  }
  return out.sort((a, b) => (b.usedAt ?? b.createdAt) - (a.usedAt ?? a.createdAt));
}

/** Turn the meals already planned in a date range into a reusable template. */
export function captureTemplate(meals: PlannedMeal[], from: ISODate, to: ISODate): TemplateMeal[] {
  return meals
    .filter((m) => m.date >= from && m.date <= to && m.status !== 'skipped' && !m.leftoverOf)
    .map((m) => ({ offset: daysBetween(from, m.date), slot: m.slot, recipeId: m.recipeId, servings: m.servings }))
    .sort((a, b) => a.offset - b.offset || a.slot.localeCompare(b.slot));
}

export interface ApplyResult {
  /** Meals to create, already dated. */
  add: { date: ISODate; slot: Slot; recipeId: string; servings: number }[];
  /** Existing meal ids that the template would land on top of. */
  conflicts: string[];
}

/**
 * Lay a template over a week. Slots that already hold a meal are left alone unless `replace`
 * is set, because the common case is filling the gaps in a half-planned week.
 */
export function applyTemplate(
  template: PlanTemplate,
  startDate: ISODate,
  existing: PlannedMeal[],
  replace = false,
): ApplyResult {
  const taken = new Map<string, PlannedMeal>();
  for (const m of existing) if (m.status !== 'skipped') taken.set(`${m.date}|${m.slot}`, m);

  const add: ApplyResult['add'] = [];
  const conflicts: string[] = [];
  for (const tm of template.meals) {
    const date = addDaysISO(startDate, tm.offset);
    const clash = taken.get(`${date}|${tm.slot}`);
    if (clash) {
      conflicts.push(clash.id);
      if (!replace) continue;
    }
    add.push({ date, slot: tm.slot, recipeId: tm.recipeId, servings: tm.servings });
  }
  return { add, conflicts };
}

/** A name that does not collide with one you already have. */
export function uniqueName(base: string, existing: PlanTemplate[]): string {
  const names = new Set(existing.map((t) => t.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base} ${n}`;
    if (!names.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${Date.now()}`;
}
