import type { Recipe } from '../../domain/types';
import { BUDGET_BYTES } from './budgetBytes';
import { COOKIE_AND_KATE } from './cookieAndKate';
import { RECIPETIN_EATS } from './recipeTinEats';

/** Built-in recipes, each adapted from (and crediting) a human recipe developer. No beef by user preference. */
export const RECIPES: Recipe[] = [...BUDGET_BYTES, ...RECIPETIN_EATS, ...COOKIE_AND_KATE];

/** Bump when built-in ingredients/recipes change so seeding upserts them (user-edited recipes are kept). */
export const SEED_VERSION = 3;
