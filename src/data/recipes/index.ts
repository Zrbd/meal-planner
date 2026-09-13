import type { Recipe } from '../../domain/types';
import { BREAKFAST_LUNCH } from './breakfastLunch';
import { DINNERS_1 } from './dinners1';
import { DINNERS_2 } from './dinners2';

export const RECIPES: Recipe[] = [...DINNERS_1, ...DINNERS_2, ...BREAKFAST_LUNCH];

/** Bump when built-in ingredients/recipes change so seeding upserts them (user-edited recipes are kept). */
export const SEED_VERSION = 1;
