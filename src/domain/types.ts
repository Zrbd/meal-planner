// Core data types shared by domain logic, DB, and UI.
// All quantities in stock/demand math are in the ingredient's baseUnit.
import type { CategoryId } from './categories';

export type BaseUnit = 'g' | 'ml' | 'ea';
export type Dimension = 'mass' | 'volume' | 'count';
export type Location = 'pantry' | 'fridge' | 'freezer';
export type Slot = 'breakfast' | 'lunch' | 'dinner';
export type ISODate = string; // 'YYYY-MM-DD' in local time
export type UnitSystem = 'us' | 'metric';
export type LooseLevel = 'plenty' | 'low' | 'out';

export const SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner'];
export const LOCATIONS: Location[] = ['fridge', 'freezer', 'pantry'];

export type AisleId =
  | 'produce'
  | 'meat'
  | 'seafood'
  | 'dairy'
  | 'bakery'
  | 'frozen'
  | 'canned'
  | 'pasta-grains'
  | 'baking'
  | 'spices'
  | 'oils-condiments'
  | 'international'
  | 'snacks'
  | 'beverages'
  | 'other';

export interface Package {
  label: string;
  qty: number; // baseUnit
}

export interface Ingredient {
  id: string;
  name: string;
  aliases: string[];
  aisle: AisleId;
  baseUnit: BaseUnit;
  density?: number; // g per ml
  gramsPerEach?: number;
  unitAliases?: Record<string, number>; // unit name -> baseUnit amount
  displayUnit?: string; // preferred display unit (must be a unitAlias), e.g. 'clove'
  packages: Package[];
  shelfLife: Partial<Record<Location, number>>; // days
  defaultLocation: Location;
  trackMode: 'exact' | 'loose';
  keepStocked: boolean;
  lowThreshold?: number; // baseUnit
  valueWeight: 1 | 2 | 3;
  /** How to store it so it lasts longer, e.g. green onions upright in a jar of water. */
  storageTip?: string;
  /** Shelf life (days) when the storage tip is followed; shown next to the tip. */
  tipShelfLife?: Partial<Record<Location, number>>;
  /** Freeze/thaw guidance for items that are often frozen. */
  thawTip?: string;
  /** Always available (tap water): never shopped for, tracked, or counted as missing. */
  alwaysOnHand?: boolean;
  /** Food category chosen by the user; otherwise derived by `categoryOf`. */
  category?: CategoryId;
  source: 'builtin' | 'user';
}

export interface RecipeCredit {
  name: string; // site or book, e.g. "Budget Bytes"
  url: string;
  author?: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  qty: number;
  unit: string;
  prep?: string;
  optional?: boolean;
  group?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  baseServings: number;
  prepMin: number;
  cookMin: number;
  difficulty: 1 | 2 | 3;
  cuisine: string;
  protein?: string;
  diet: string[];
  slots: Slot[];
  ingredients: RecipeIngredient[];
  steps: string[]; // timers are detected from text in cook mode
  notes?: string;
  /** Where the recipe comes from. Built-in recipes are adapted from these and link back. */
  credit?: RecipeCredit;
  favorite: boolean;
  rating?: number;
  archived: boolean;
  source: 'builtin' | 'user';
  userEdited: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StockLot {
  id: string;
  ingredientId: string;
  qty: number;
  location: Location;
  addedAt: number;
  expiresOn?: ISODate;
}

export interface LooseStock {
  ingredientId: string;
  level: LooseLevel;
  updatedAt: number;
}

export interface InventoryTxn {
  id: string;
  ingredientId: string;
  delta: number;
  reason: 'purchase' | 'cook' | 'adjust' | 'waste';
  refId?: string;
  lotSnapshot?: { lotId: string; expiresOn?: ISODate; location: Location; addedAt: number };
  note?: string;
  at: number;
}

export interface PlannedMeal {
  id: string;
  date: ISODate;
  slot: Slot;
  recipeId: string;
  servings: number;
  status: 'planned' | 'cooked' | 'skipped';
  leftoverOf?: string;
  cookedAt?: number;
}

export interface CookLog {
  id: string;
  recipeId: string;
  plannedMealId?: string;
  at: number;
  used: { ingredientId: string; qty: number }[];
}

export interface ShoppingState {
  key: string; // ingredientId, or 'manual:<id>'
  checked: boolean;
  haveIt?: boolean;
  qtyOverride?: number; // baseUnit
  manualName?: string;
  /** What you paid for this line, in dollars. */
  price?: number;
}

export interface TripLine {
  ingredientId?: string;
  name: string;
  qty: number;
  /** Dollars paid for the whole line. */
  price?: number;
}

export interface Trip {
  id: string;
  range: [ISODate, ISODate];
  finishedAt: number;
  lines: TripLine[];
}

export interface Settings {
  householdSize: number;
  units: UnitSystem;
  weekStartsOn: 0 | 1;
  shoppingDay: number; // 0=Sun … 6=Sat
  enabledSlots: Slot[];
  mealsPerWeek: Record<Slot, number>;
  weeknightMaxMin: number;
  dietFilters: string[]; // recipes must have all of these tags
  dislikedIngredients: string[];
  aisleOrder: AisleId[];
  bufferDays: number;
  /** Show alerts as phone notifications + app badge when the app opens. */
  notifications: boolean;
  lastBackupAt?: number;
}
