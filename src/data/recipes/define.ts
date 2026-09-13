// Compact authoring format for built-in recipes.
import type { Recipe, RecipeCredit, RecipeIngredient, Slot } from '../../domain/types';

/** [qty, unit, ingredientId, prep?, optional?] — or a string to start an ingredient group ("For the sauce"). */
export type IngTuple = [number, string, string, string?, 'optional'?] | string;

export interface RecipeDef {
  id: string;
  title: string;
  description: string;
  servings: number;
  prep: number;
  cook: number;
  difficulty?: 1 | 2 | 3;
  cuisine: string;
  protein?: string;
  diet?: string[];
  slots?: Slot[];
  ingredients: IngTuple[];
  steps: string[];
  notes?: string;
  /** Required for built-ins: the human source this recipe is adapted from. Steps are rewritten, not copied. */
  credit: RecipeCredit;
}

export function defineRecipe(d: RecipeDef): Recipe {
  let group: string | undefined;
  const ingredients: RecipeIngredient[] = [];
  for (const t of d.ingredients) {
    if (typeof t === 'string') {
      group = t;
      continue;
    }
    const [qty, unit, ingredientId, prep, opt] = t;
    ingredients.push({ ingredientId, qty, unit, prep: prep || undefined, optional: opt === 'optional' || undefined, group });
  }
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    baseServings: d.servings,
    prepMin: d.prep,
    cookMin: d.cook,
    difficulty: d.difficulty ?? 1,
    cuisine: d.cuisine,
    protein: d.protein,
    diet: d.diet ?? [],
    slots: d.slots ?? ['dinner'],
    ingredients,
    steps: d.steps,
    notes: d.notes,
    credit: d.credit,
    favorite: false,
    archived: false,
    source: 'builtin',
    userEdited: false,
    createdAt: 0,
    updatedAt: 0,
  };
}
