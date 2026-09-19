import type { AutoPick } from '../domain/autoplan';
import type { ISODate, PlannedMeal, Slot } from '../domain/types';
import { addDaysISO, daysBetween } from '../domain/dates';
import { db } from '../db/schema';
import { newId } from './ids';

export async function addMeal(recipeId: string, date: ISODate, slot: Slot, servings: number): Promise<string> {
  const id = newId();
  await db.meals.add({ id, recipeId, date, slot, servings, status: 'planned' });
  return id;
}

export async function updateMeal(id: string, patch: Partial<Omit<PlannedMeal, 'id'>>): Promise<void> {
  await db.meals.update(id, patch);
}

export async function removeMeal(id: string): Promise<void> {
  await db.transaction('rw', db.meals, async () => {
    await db.meals.delete(id);
    // leftovers of this meal become orphans; remove them too
    const children = await db.meals.filter((m) => m.leftoverOf === id).primaryKeys();
    await db.meals.bulkDelete(children);
  });
}

export async function setSkipped(id: string, skipped: boolean): Promise<void> {
  await db.meals.update(id, { status: skipped ? 'skipped' : 'planned' });
}

/** Plan leftovers of a meal on another day (needs no extra ingredients). */
export async function addLeftovers(mealId: string, date: ISODate, slot: Slot): Promise<string | undefined> {
  const m = await db.meals.get(mealId);
  if (!m) return undefined;
  const id = newId();
  await db.meals.add({ id, recipeId: m.recipeId, date, slot, servings: m.servings, status: 'planned', leftoverOf: m.id });
  return id;
}

export async function applyAutoPlan(picks: AutoPick[], servings: number): Promise<void> {
  await db.meals.bulkAdd(
    picks.map((p) => ({ id: newId(), recipeId: p.recipeId, date: p.date, slot: p.slot, servings, status: 'planned' as const })),
  );
}

export async function clearPlanned(from: ISODate, to: ISODate): Promise<void> {
  const ids = await db.meals
    .where('date').between(from, to, true, true)
    .filter((m) => m.status === 'planned')
    .primaryKeys();
  await db.meals.bulkDelete(ids);
}

export interface CopyWeekResult {
  copied: number;
  skipped: number;
}

/**
 * Copy one week of meals onto another week, day for day.
 * Slots that already have something planned are left alone, and days in the past are skipped.
 */
export async function copyWeek(fromStart: ISODate, toStart: ISODate, today: ISODate): Promise<CopyWeekResult> {
  const offset = daysBetween(fromStart, toStart);
  if (offset === 0) return { copied: 0, skipped: 0 };
  return db.transaction('rw', db.meals, async () => {
    const source = await db.meals.where('date').between(fromStart, addDaysISO(fromStart, 6), true, true).toArray();
    const target = await db.meals.where('date').between(toStart, addDaysISO(toStart, 6), true, true).toArray();
    const taken = new Set(target.map((m) => `${m.date}:${m.slot}`));
    const rows: PlannedMeal[] = [];
    let skipped = 0;
    for (const m of source) {
      // leftovers follow their parent meal, so copying them separately would double-count
      if (m.leftoverOf) continue;
      const date = addDaysISO(m.date, offset);
      if (date < today || taken.has(`${date}:${m.slot}`)) {
        skipped++;
        continue;
      }
      taken.add(`${date}:${m.slot}`);
      rows.push({ id: newId(), recipeId: m.recipeId, date, slot: m.slot, servings: m.servings, status: 'planned' });
    }
    await db.meals.bulkAdd(rows);
    return { copied: rows.length, skipped };
  });
}
