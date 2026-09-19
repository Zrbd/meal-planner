// Cook journal entries, stored in one kv row alongside the recipe's star rating.
import { parseJournal, type JournalEntry } from '../domain/journal';
import { db } from '../db/schema';
import { newId } from './ids';

const KEY = 'journal';
const MAX = 500;

async function read(): Promise<JournalEntry[]> {
  return parseJournal((await db.kv.get(KEY))?.value);
}

export async function addJournalEntry(entry: Omit<JournalEntry, 'id' | 'at'> & { at?: number }): Promise<string> {
  const id = newId();
  await db.transaction('rw', db.kv, db.recipes, async () => {
    const list = await read();
    const row: JournalEntry = { ...entry, id, at: entry.at ?? Date.now() };
    await db.kv.put({ key: KEY, value: [row, ...list].slice(0, MAX) });
    // A rating left in the journal is the same rating shown on the recipe.
    if (row.rating) await db.recipes.update(row.recipeId, { rating: row.rating });
  });
  return id;
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await db.kv.put({ key: KEY, value: (await read()).filter((e) => e.id !== id) });
  });
}
