import { substitute } from '../domain/substitute';
import type { Recipe } from '../domain/types';
import { db } from '../db/schema';
import { newId, slugify } from './ids';
import { recordRevision } from './history';

export type RecipeDraft = Omit<Recipe, 'id' | 'source' | 'userEdited' | 'createdAt' | 'updatedAt' | 'favorite' | 'archived'> &
  Partial<Pick<Recipe, 'id' | 'favorite' | 'archived'>>;

export async function saveRecipe(draft: RecipeDraft): Promise<string> {
  const now = Date.now();
  return db.transaction('rw', db.recipes, db.kv, async () => {
    const existing = draft.id ? await db.recipes.get(draft.id) : undefined;
    if (existing) {
      const updated: Recipe = {
        ...existing, ...draft, id: existing.id,
        userEdited: existing.source === 'builtin' ? true : existing.userEdited,
        updatedAt: now,
      };
      // Keep the version you are about to overwrite, so an edit is always undoable.
      await recordRevision(existing, updated);
      await db.recipes.put(updated);
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

/** Swap one ingredient line for another (or back to the original); the plan and shopping list follow. */
export async function substituteIngredient(recipeId: string, idx: number, newIngredientId: string): Promise<void> {
  await db.transaction('rw', db.recipes, db.ingredients, async () => {
    const recipe = await db.recipes.get(recipeId);
    const newIng = await db.ingredients.get(newIngredientId);
    if (!recipe || !newIng || !recipe.ingredients[idx]) return;
    const ingById = new Map((await db.ingredients.toArray()).map((i) => [i.id, i]));
    await db.recipes.put({
      ...recipe,
      ingredients: substitute(recipe, idx, newIng, ingById),
      userEdited: recipe.source === 'builtin' ? true : recipe.userEdited,
      updatedAt: Date.now(),
    });
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
