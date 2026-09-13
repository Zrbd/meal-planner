import type { AutoPick } from '../domain/autoplan';
import type { ISODate, PlannedMeal, Slot } from '../domain/types';
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
