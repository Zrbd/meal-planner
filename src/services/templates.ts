// Saving and applying weeks.
import { applyTemplate, captureTemplate, parseTemplates, uniqueName, type PlanTemplate } from '../domain/templates';
import type { ISODate } from '../domain/types';
import { db } from '../db/schema';
import { newId } from './ids';

const KEY = 'planTemplates';
const MAX = 20;

async function read(): Promise<PlanTemplate[]> {
  return parseTemplates((await db.kv.get(KEY))?.value);
}

/** Snapshot the meals in a date range under a name. */
export async function saveTemplate(name: string, from: ISODate, to: ISODate): Promise<string | undefined> {
  const id = newId();
  let saved: string | undefined;
  await db.transaction('rw', db.kv, db.meals, async () => {
    const meals = await db.meals.where('date').between(from, to, true, true).toArray();
    const captured = captureTemplate(meals, from, to);
    if (!captured.length) return;
    const list = await read();
    const template: PlanTemplate = {
      id,
      name: uniqueName(name.trim() || 'Saved week', list),
      meals: captured,
      createdAt: Date.now(),
    };
    await db.kv.put({ key: KEY, value: [template, ...list].slice(0, MAX) });
    saved = id;
  });
  return saved;
}

export async function renameTemplate(id: string, name: string): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const list = await read();
    const others = list.filter((t) => t.id !== id);
    await db.kv.put({
      key: KEY,
      value: list.map((t) => (t.id === id ? { ...t, name: uniqueName(name.trim() || t.name, others) } : t)),
    });
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await db.kv.put({ key: KEY, value: (await read()).filter((t) => t.id !== id) });
  });
}

/** Drop a saved week onto a start date. Returns how many meals it actually added. */
export async function useTemplate(id: string, startDate: ISODate, replace = false): Promise<number> {
  let added = 0;
  await db.transaction('rw', db.kv, db.meals, async () => {
    const list = await read();
    const template = list.find((t) => t.id === id);
    if (!template) return;
    const existing = await db.meals.toArray();
    const { add, conflicts } = applyTemplate(template, startDate, existing, replace);
    if (replace && conflicts.length) await db.meals.bulkDelete(conflicts);
    if (add.length) {
      await db.meals.bulkAdd(add.map((m) => ({ id: newId(), ...m, status: 'planned' as const })));
      added = add.length;
    }
    await db.kv.put({ key: KEY, value: list.map((t) => (t.id === id ? { ...t, usedAt: Date.now() } : t)) });
  });
  return added;
}
