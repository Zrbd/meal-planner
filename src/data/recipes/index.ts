import type { Recipe } from '../../domain/types';
import { BUDGET_BYTES } from './budgetBytes';
import { BUDGET_BYTES_2 } from './budgetBytes2';
import { BUDGET_BYTES_3 } from './budgetBytes3';
import { BUDGET_BYTES_4 } from './budgetBytes4';
import { BUDGET_BYTES_5 } from './budgetBytes5';
import { BUDGET_BYTES_6 } from './budgetBytes6';
import { BUDGET_BYTES_7 } from './budgetBytes7';
import { BUDGET_BYTES_8 } from './budgetBytes8';
import { BUDGET_BYTES_9 } from './budgetBytes9';
import { BUDGET_BYTES_10 } from './budgetBytes10';
import { BUDGET_BYTES_11 } from './budgetBytes11';
import { BUDGET_BYTES_12 } from './budgetBytes12';
import { BUDGET_BYTES_13 } from './budgetBytes13';
import { BUDGET_BYTES_14 } from './budgetBytes14';
import { BUDGET_BYTES_15 } from './budgetBytes15';
import { BUDGET_BYTES_16 } from './budgetBytes16';
import { BUDGET_BYTES_17 } from './budgetBytes17';
import { BUDGET_BYTES_18 } from './budgetBytes18';
import { BUDGET_BYTES_19 } from './budgetBytes19';
import { BUDGET_BYTES_20 } from './budgetBytes20';
import { BUDGET_BYTES_21 } from './budgetBytes21';
import { BUDGET_BYTES_22 } from './budgetBytes22';
import { COOKIE_AND_KATE } from './cookieAndKate';
import { RECIPETIN_EATS } from './recipeTinEats';
import { RECIPETIN_EATS_2 } from './recipeTinEats2';
import { RECIPETIN_EATS_3 } from './recipeTinEats3';
import { RECIPETIN_EATS_4 } from './recipeTinEats4';
import { RECIPETIN_EATS_5 } from './recipeTinEats5';
import { RECIPETIN_EATS_6 } from './recipeTinEats6';
import { RECIPETIN_EATS_7 } from './recipeTinEats7';
import { RECIPETIN_EATS_8 } from './recipeTinEats8';
import { RECIPETIN_EATS_9 } from './recipeTinEats9';
import { RECIPETIN_EATS_10 } from './recipeTinEats10';
import { RECIPETIN_EATS_11 } from './recipeTinEats11';
import { RECIPETIN_EATS_12 } from './recipeTinEats12';
import { RECIPETIN_EATS_13 } from './recipeTinEats13';
import { RECIPETIN_EATS_14 } from './recipeTinEats14';
import { RECIPETIN_EATS_15 } from './recipeTinEats15';

/** Built-in recipes, each adapted from (and crediting) a human recipe developer. No beef by user preference. */
export const RECIPES: Recipe[] = [
  ...BUDGET_BYTES, ...BUDGET_BYTES_2, ...BUDGET_BYTES_3, ...BUDGET_BYTES_4, ...BUDGET_BYTES_5, ...BUDGET_BYTES_6,
  ...BUDGET_BYTES_7, ...BUDGET_BYTES_8, ...BUDGET_BYTES_9, ...BUDGET_BYTES_10, ...BUDGET_BYTES_11, ...BUDGET_BYTES_12, ...BUDGET_BYTES_13, ...BUDGET_BYTES_14, ...BUDGET_BYTES_15, ...BUDGET_BYTES_16, ...BUDGET_BYTES_17, ...BUDGET_BYTES_18, ...BUDGET_BYTES_19, ...BUDGET_BYTES_20, ...BUDGET_BYTES_21, ...BUDGET_BYTES_22,
  ...RECIPETIN_EATS, ...RECIPETIN_EATS_2, ...RECIPETIN_EATS_3, ...RECIPETIN_EATS_4, ...RECIPETIN_EATS_5, ...RECIPETIN_EATS_6, ...RECIPETIN_EATS_7, ...RECIPETIN_EATS_8, ...RECIPETIN_EATS_9, ...RECIPETIN_EATS_10, ...RECIPETIN_EATS_11, ...RECIPETIN_EATS_12, ...RECIPETIN_EATS_13, ...RECIPETIN_EATS_14, ...RECIPETIN_EATS_15, ...COOKIE_AND_KATE,
];

/** Bump when built-in ingredients/recipes change so seeding upserts them (user-edited recipes are kept). */
export const SEED_VERSION = 24;
