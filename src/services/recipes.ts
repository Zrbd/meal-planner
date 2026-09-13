import type { Recipe } from '../domain/types';
import { db } from '../db/schema';
import { newId, slugify } from './ids';

export type RecipeDraft = Omit<Recipe, 'id' | 'source' | 'userEdited' | 'createdAt' | 'updatedAt' | 'favorite' | 'archived'> &
  Partial<Pick<Recipe, 'id' | 'favorite' | 'archived'>>;

export async function saveRecipe(draft: RecipeDraft): Promise<string> {
  const now = Date.now();
  return db.transaction('rw', db.recipes, async () => {
    const existing = draft.id ? await db.recipes.get(draft.id) : undefined;
    if (existing) {
      await db.recipes.put({
        ...existing, ...draft, id: existing.id,
        userEdited: existing.source === 'builtin' ? true : existing.userEdited,
        updatedAt: now,
      });
      return existing.id;
    }
    let id = slugify(draft.title) || newId();
    if (await db.recipes.get(id)) id = `${id}-${newId().slice(0, 4)}`;
    await db.recipes.add({
      ...draft, id, favorite: draft.favorite ?? false, archived: false,
      source: 'user', userEdited: false, createdAt: now, updatedAt: now,
    });
    return id;
  });
}

export async function toggleFavorite(id: string): Promise<void> {
  const r = await db.recipes.get(id);
  if (r) await db.recipes.update(id, { favorite: !r.favorite });
}

export async function setRating(id: string, rating: number | undefined): Promise<void> {
  await db.recipes.update(id, { rating });
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  await db.recipes.update(id, { archived });
}

export async function duplicateRecipe(id: string): Promise<string | undefined> {
  const r = await db.recipes.get(id);
  if (!r) return undefined;
  const { id: _id, ...rest } = r;
  void _id;
  return saveRecipe({ ...rest, title: `${r.title} (copy)`, favorite: false });
}

/** User recipes can be deleted outright; built-ins are archived instead (so reseeding doesn't resurrect them). */
export async function deleteRecipe(id: string): Promise<void> {
  const r = await db.recipes.get(id);
  if (!r) return;
  if (r.source === 'builtin') await db.recipes.update(id, { archived: true });
  else await db.recipes.delete(id);
}
