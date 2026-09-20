// Sending one recipe to another phone. The full backup is the wrong tool for "send me your
// chili" — this packs a single recipe, plus just enough about the ingredients it references
// that the receiving phone can rebuild anything missing from its catalog.
import type { Ingredient, Recipe } from './types';

export const SHARE_VERSION = 1;
export const SHARE_KIND = 'meal-planner/recipe';

export interface SharedRecipe {
  kind: typeof SHARE_KIND;
  version: number;
  exportedAt: number;
  recipe: Recipe;
  /** Catalog entries for every ingredient the recipe names, so nothing arrives broken. */
  ingredients: Ingredient[];
}

/** Fields that are about *your* history with a recipe, not the recipe itself. */
function stripPersonal(recipe: Recipe): Recipe {
  const { favorite, rating, archived, ...rest } = recipe;
  void favorite;
  void rating;
  void archived;
  return rest as Recipe;
}

export function exportRecipe(recipe: Recipe, ingById: Map<string, Ingredient>, at: number): SharedRecipe {
  const ingredients: Ingredient[] = [];
  for (const line of recipe.ingredients) {
    const ing = ingById.get(line.ingredientId);
    if (ing) ingredients.push(ing);
  }
  return { kind: SHARE_KIND, version: SHARE_VERSION, exportedAt: at, recipe: stripPersonal(recipe), ingredients };
}

export function toJSON(shared: SharedRecipe): string {
  return JSON.stringify(shared, null, 2);
}

export interface ImportResult {
  shared: SharedRecipe;
  /** Ingredients the receiving catalog does not have yet and will need to add. */
  newIngredients: Ingredient[];
  /** True when a recipe with this id already exists, so the UI can offer replace vs. copy. */
  collides: boolean;
}

export class ShareError extends Error {}

export function parseShared(text: string, existingRecipeIds: Set<string>, ingById: Map<string, Ingredient>): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ShareError("That doesn't look like a recipe file.");
  }
  const s = raw as Partial<SharedRecipe>;
  if (s?.kind !== SHARE_KIND) throw new ShareError('That file came from something else.');
  if (typeof s.version !== 'number' || s.version > SHARE_VERSION) {
    throw new ShareError('That recipe was exported by a newer version of the app.');
  }
  const recipe = s.recipe as Recipe | undefined;
  if (!recipe || typeof recipe.id !== 'string' || typeof recipe.title !== 'string' || !Array.isArray(recipe.ingredients)) {
    throw new ShareError('The recipe in that file is incomplete.');
  }
  const ingredients = Array.isArray(s.ingredients) ? (s.ingredients as Ingredient[]) : [];
  const newIngredients = ingredients.filter((i) => i?.id && !ingById.has(i.id));

  const missing = recipe.ingredients.filter(
    (line) => !ingById.has(line.ingredientId) && !ingredients.some((i) => i.id === line.ingredientId),
  );
  if (missing.length) {
    throw new ShareError(`That file is missing details for ${missing.length} ingredient${missing.length === 1 ? '' : 's'}.`);
  }

  return {
    shared: { kind: SHARE_KIND, version: s.version, exportedAt: s.exportedAt ?? Date.now(), recipe, ingredients },
    newIngredients,
    collides: existingRecipeIds.has(recipe.id),
  };
}

/** A fresh id when importing alongside a recipe you already have. */
export function copyId(id: string, existing: Set<string>): string {
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${id}-${n}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${id}-${Date.now()}`;
}

/** Filename for the share sheet: 'chicken-tinola.recipe.json'. */
export function shareFilename(recipe: Recipe): string {
  const slug = recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'recipe';
  return `${slug}.recipe.json`;
}
