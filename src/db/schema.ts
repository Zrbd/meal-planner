import Dexie, { type EntityTable } from 'dexie';
import type {
  CookLog, Ingredient, InventoryTxn, LooseStock, PlannedMeal, Recipe, ShoppingState, StockLot, Trip,
} from '../domain/types';

export interface KV {
  key: string;
  value: unknown;
}

export class MealDB extends Dexie {
  ingredients!: EntityTable<Ingredient, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  lots!: EntityTable<StockLot, 'id'>;
  loose!: EntityTable<LooseStock, 'ingredientId'>;
  txns!: EntityTable<InventoryTxn, 'id'>;
  meals!: EntityTable<PlannedMeal, 'id'>;
  cookLogs!: EntityTable<CookLog, 'id'>;
  shopping!: EntityTable<ShoppingState, 'key'>;
  trips!: EntityTable<Trip, 'id'>;
  kv!: EntityTable<KV, 'key'>;

  constructor(name = 'meal-planner') {
    super(name);
    this.version(1).stores({
      ingredients: 'id, name, aisle',
      recipes: 'id, title, updatedAt',
      lots: 'id, ingredientId, expiresOn',
      loose: 'ingredientId',
      txns: 'id, ingredientId, at, refId',
      meals: 'id, date, recipeId',
      cookLogs: 'id, recipeId, at',
      shopping: 'key',
      trips: 'id, finishedAt',
      kv: 'key',
    });
  }
}

export const db = new MealDB();

export const ALL_TABLES = [
  'ingredients', 'recipes', 'lots', 'loose', 'txns', 'meals', 'cookLogs', 'shopping', 'trips', 'kv',
] as const;
export type TableName = (typeof ALL_TABLES)[number];
