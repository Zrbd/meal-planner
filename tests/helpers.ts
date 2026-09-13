import { INGREDIENTS } from '../src/data/ingredients';
import { defineRecipe } from '../src/data/recipes/define';
import type { Ingredient, PlannedMeal, StockLot } from '../src/domain/types';

export const ingById = new Map<string, Ingredient>(INGREDIENTS.map((i) => [i.id, i]));
export const ing = (id: string) => {
  const i = ingById.get(id);
  if (!i) throw new Error(`no ingredient ${id}`);
  return i;
};

// Small, stable recipe fixtures so domain tests don't break when the built-in catalog changes.
const credit = { name: 'Test fixture', url: 'https://example.com' };
export const TEST_RECIPES = [
  defineRecipe({
    id: 'test-tacos', title: 'Turkey Tacos', description: '', servings: 4, prep: 10, cook: 15, cuisine: 'Mexican', protein: 'turkey', credit,
    ingredients: [[1, 'lb', 'ground-turkey'], [1, 'ea', 'yellow-onion'], [2, 'tbsp', 'chili-powder'], [8, 'ea', 'corn-tortillas']],
    steps: ['Cook.'],
  }),
  defineRecipe({
    id: 'test-pasta', title: 'Turkey Pasta', description: '', servings: 4, prep: 10, cook: 25, cuisine: 'Italian', protein: 'turkey', credit,
    ingredients: [[1, 'lb', 'ground-turkey'], [1, 'lb', 'spaghetti'], [1, 'jar', 'marinara']],
    steps: ['Cook.'],
  }),
  defineRecipe({
    id: 'test-shakshuka', title: 'Shakshuka', description: '', servings: 4, prep: 10, cook: 25, cuisine: 'Middle Eastern', protein: 'egg', diet: ['vegetarian'], credit,
    ingredients: [[2, 'tbsp', 'olive-oil'], [1, 'can', 'crushed-tomatoes'], [6, 'ea', 'eggs'], [0.5, 'cup', 'feta']],
    steps: ['Simmer 10 minutes.'],
  }),
  defineRecipe({
    id: 'test-curry', title: 'Chickpea Curry', description: '', servings: 4, prep: 10, cook: 25, cuisine: 'Indian', protein: 'beans', diet: ['vegetarian'], credit,
    ingredients: [[1, 'ea', 'yellow-onion'], [2, 'can', 'chickpeas'], [1, 'can', 'diced-tomatoes'], [1, 'can', 'coconut-milk'], [4, 'cup', 'spinach']],
    steps: ['Cook.'],
  }),
  defineRecipe({
    id: 'test-salmon', title: 'Lemon Salmon', description: '', servings: 4, prep: 5, cook: 15, cuisine: 'American', protein: 'fish', credit,
    ingredients: [[1.5, 'lb', 'salmon'], [1, 'ea', 'lemon'], [3, 'clove', 'garlic']],
    steps: ['Roast.'],
  }),
  defineRecipe({
    id: 'test-bean-bowl', title: 'Bean Bowl', description: '', servings: 4, prep: 10, cook: 20, cuisine: 'Mexican', protein: 'beans', diet: ['vegetarian'], credit,
    ingredients: [[1.5, 'cup', 'white-rice'], [2, 'can', 'black-beans'], [1, 'ea', 'avocado']],
    steps: ['Cook.'],
  }),
  defineRecipe({
    id: 'test-chicken', title: 'Chicken & Broccoli', description: '', servings: 4, prep: 10, cook: 20, cuisine: 'Chinese', protein: 'chicken', credit,
    ingredients: [[1.5, 'lb', 'chicken-thighs'], [1, 'crown', 'broccoli'], [3, 'ea', 'green-onion']],
    steps: ['Cook.'],
  }),
];
export const recipesById = new Map(TEST_RECIPES.map((r) => [r.id, r]));

let n = 0;
export function lot(ingredientId: string, qty: number, extra: Partial<StockLot> = {}): StockLot {
  n++;
  return { id: `lot${n}`, ingredientId, qty, location: 'fridge', addedAt: n, ...extra };
}

export function meal(recipeId: string, date: string, extra: Partial<PlannedMeal> = {}): PlannedMeal {
  n++;
  return { id: `m${n}`, recipeId, date, slot: 'dinner', servings: 4, status: 'planned', ...extra };
}
