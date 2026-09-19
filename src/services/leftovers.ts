// Cooking once for several nights, and what goes in the freezer when a night falls through.
import { db } from '../db/schema';
import { addDaysISO, todayISO } from '../domain/dates';
import {
  FREEZER_DAYS, batchServings, leftoverSlots, parseFreezer, takePortion, type FreezerMeal, type LeftoverSlot,
} from '../domain/leftovers';
import type { ISODate, Slot } from '../domain/types';
import { newId } from './ids';

const KEY = 'freezer';

async function readFreezer(): Promise<FreezerMeal[]> {
  return parseFreezer((await db.kv.get(KEY))?.value);
}

async function writeFreezer(list: FreezerMeal[]): Promise<void> {
  await db.kv.put({ key: KEY, value: list });
}

export interface BatchPlan {
  /** Servings the parent meal will be scaled up to. */
  servings: number;
  nights: LeftoverSlot[];
}

/**
 * Scale a planned meal up and put the extra portions on the calendar. The shopping list picks
 * the bigger amounts up automatically, because it reads servings off the meal.
 */
export async function planBatchCook(mealId: string, extraNights: number): Promise<BatchPlan | undefined> {
  return db.transaction('rw', db.meals, async () => {
    const meal = await db.meals.get(mealId);
    if (!meal || meal.leftoverOf) return undefined;
    const all = await db.meals.toArray();
    const nights = leftoverSlots({ from: meal.date, slot: meal.slot, nights: extraNights, meals: all });
    const perMeal = meal.servings;
    const servings = batchServings(perMeal, nights.length);
    await db.meals.update(mealId, { servings });
    for (const n of nights) {
      await db.meals.add({
        id: newId(), recipeId: meal.recipeId, date: n.date, slot: n.slot,
        servings: perMeal, status: 'planned', leftoverOf: meal.id,
      });
    }
    return { servings, nights };
  });
}

/** Undo a batch: drop the leftover nights and put the parent meal back to one night's worth. */
export async function unbatch(mealId: string): Promise<void> {
  await db.transaction('rw', db.meals, async () => {
    const meal = await db.meals.get(mealId);
    if (!meal) return;
    const kids = await db.meals.filter((m) => m.leftoverOf === mealId).toArray();
    if (!kids.length) return;
    await db.meals.bulkDelete(kids.map((k) => k.id));
    await db.meals.update(mealId, { servings: kids[0].servings });
  });
}

// ---------- freezer ----------

export async function freezePortions(input: {
  recipeId: string;
  portions: number;
  servingsEach: number;
  note?: string;
  today?: ISODate;
}): Promise<void> {
  const today = input.today ?? todayISO();
  const entry: FreezerMeal = {
    id: newId(),
    recipeId: input.recipeId,
    portions: Math.max(1, Math.round(input.portions)),
    servingsEach: Math.max(1, input.servingsEach),
    frozenAt: Date.now(),
    eatBy: addDaysISO(today, FREEZER_DAYS),
    note: input.note?.trim() || undefined,
  };
  await db.transaction('rw', db.kv, async () => {
    await writeFreezer([...(await readFreezer()), entry]);
  });
}

/** Pull one portion out and drop it onto the plan as a no-cook meal. */
export async function planFromFreezer(id: string, date: ISODate, slot: Slot): Promise<void> {
  await db.transaction('rw', db.kv, db.meals, async () => {
    const list = await readFreezer();
    const entry = list.find((m) => m.id === id);
    if (!entry) return;
    await db.meals.add({
      id: newId(), recipeId: entry.recipeId, date, slot,
      servings: entry.servingsEach, status: 'planned', leftoverOf: `freezer:${entry.id}`,
    });
    await writeFreezer(takePortion(list, id));
  });
}

/** Ate it, or threw it out — either way it leaves the freezer. */
export async function removeFromFreezer(id: string, all = false): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const list = await readFreezer();
    await writeFreezer(all ? list.filter((m) => m.id !== id) : takePortion(list, id));
  });
}
