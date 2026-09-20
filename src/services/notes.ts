// Brand and shelf notes on catalog ingredients.
import { parseNotes, setNote, type IngredientNote } from '../domain/ingredientnotes';
import { db } from '../db/schema';

const KEY = 'ingredientNotes';

export async function saveIngredientNote(
  ingredientId: string,
  patch: Omit<IngredientNote, 'updatedAt'>,
): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const map = parseNotes((await db.kv.get(KEY))?.value);
    await db.kv.put({ key: KEY, value: setNote(map, ingredientId, patch, Date.now()) });
  });
}

export async function clearIngredientNote(ingredientId: string): Promise<void> {
  await saveIngredientNote(ingredientId, {});
}
