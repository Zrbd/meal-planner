// One live query over the whole (small) database. Every screen reads from here;
// writes go through src/services and the query re-runs automatically.
import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { db, type RecipePhoto } from '../db/schema';
import { withDefaults } from '../db/settings';
import { todayISO } from '../domain/dates';
import { usageRate } from '../domain/forecast';
import { parseCollections, type Collection } from '../domain/collections';
import { parseJournal, type JournalEntry } from '../domain/journal';
import { parseFreezer, type FreezerMeal } from '../domain/leftovers';
import { parseRecent } from '../domain/recent';
import type {
  CookLog, Ingredient, InventoryTxn, ISODate, LooseStock, PlannedMeal, Recipe, Settings, ShoppingState, StockLot, Trip,
} from '../domain/types';

const DAY = 86_400_000;

export interface AppData {
  today: ISODate;
  now: number;
  ingredients: Ingredient[];
  ingById: Map<string, Ingredient>;
  recipes: Recipe[];
  recipeById: Map<string, Recipe>;
  lots: StockLot[];
  loose: LooseStock[];
  looseById: Map<string, LooseStock>;
  txns: InventoryTxn[];
  meals: PlannedMeal[];
  cookLogs: CookLog[];
  shopping: ShoppingState[];
  trips: Trip[];
  settings: Settings;
  lastBackupAt?: number;
  /** Last automatic on-device backup copy. */
  autoBackupAt?: number;
  /** When data was last brought back from that copy. */
  autoRestoredAt?: number;
  /** Checked-off prep checklist task ids. */
  prepChecks: Set<string>;
  /** Ingredients already answered for in the pantry walkthrough. */
  stockChecked: Set<string>;
  dailyRates: Map<string, number>;
  /** Recipe collections you made yourself. */
  collections: Collection[];
  /** Notes you left after cooking. */
  journal: JournalEntry[];
  /** Your own photos of finished dishes, by recipe id. */
  photoByRecipe: Map<string, RecipePhoto>;
  /** Cooked portions waiting in the freezer. */
  freezer: FreezerMeal[];
  /** Recipe ids you opened lately, most recent first. */
  recent: string[];
}

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    const tick = () => setToday(todayISO());
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const raw = useLiveQuery(async () => {
    const since = Date.now() - 60 * DAY;
    const [ingredients, recipes, lots, loose, txns, meals, cookLogs, shopping, trips, settingsRow, backupRow, autoRow, restoredRow, checksRow, stockCheckRow, collectionsRow, journalRow, photos, freezerRow, recentRow] =
      await Promise.all([
        db.ingredients.toArray(),
        db.recipes.toArray(),
        db.lots.toArray(),
        db.loose.toArray(),
        db.txns.where('at').above(since).toArray(),
        db.meals.toArray(),
        db.cookLogs.orderBy('at').reverse().toArray(),
        db.shopping.toArray(),
        db.trips.orderBy('finishedAt').reverse().limit(500).toArray(),
        db.kv.get('settings'),
        db.kv.get('lastBackupAt'),
        db.kv.get('autoBackupAt'),
        db.kv.get('autoRestoredAt'),
        db.kv.get('prepChecks'),
        db.kv.get('stockCheck'),
        db.kv.get('collections'),
        db.kv.get('journal'),
        db.photos.toArray(),
        db.kv.get('freezer'),
        db.kv.get('recent'),
      ]);
    return {
      ingredients, recipes, lots, loose, txns, meals, cookLogs, shopping, trips,
      settings: withDefaults(settingsRow?.value as Partial<Settings> | undefined),
      lastBackupAt: backupRow?.value as number | undefined,
      autoBackupAt: autoRow?.value as number | undefined,
      autoRestoredAt: restoredRow?.value as number | undefined,
      prepChecks: new Set((checksRow?.value as string[] | undefined) ?? []),
      stockChecked: new Set(((stockCheckRow?.value as { done?: string[] } | undefined)?.done ?? [])),
      collections: parseCollections(collectionsRow?.value),
      journal: parseJournal(journalRow?.value),
      photos,
      freezer: parseFreezer(freezerRow?.value),
      recent: parseRecent(recentRow?.value),
      loadedAt: Date.now(),
    };
  }, []);

  const value = useMemo<AppData | null>(() => {
    if (!raw) return null;
    const { loadedAt, photos, ...rest } = raw;
    const dailyRates = new Map<string, number>();
    for (const id of new Set(rest.txns.map((t) => t.ingredientId))) dailyRates.set(id, usageRate(rest.txns, id, loadedAt));
    return {
      ...rest,
      today,
      now: loadedAt,
      ingById: new Map(rest.ingredients.map((i) => [i.id, i])),
      recipeById: new Map(rest.recipes.map((r) => [r.id, r])),
      looseById: new Map(rest.loose.map((l) => [l.ingredientId, l])),
      photoByRecipe: new Map(photos.map((p) => [p.recipeId, p])),
      dailyRates,
    };
  }, [raw, today]);

  if (!value) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-stone-400">
        <span className="animate-pulse text-4xl">🍳</span>
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData outside AppDataProvider');
  return v;
}
