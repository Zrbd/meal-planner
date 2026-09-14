// Automatic backup copy kept on the device, refreshed whenever the app opens or goes to the background.
// If the database comes back empty (cleared or corrupted) but the copy has your data, it's restored.
import { exportBackup, importBackup, type Backup } from './backup';
import { db, type MealDB } from './schema';

export interface MirrorStore {
  read(): Promise<string | null>;
  write(json: string): Promise<void>;
  clear(): Promise<void>;
}

const KEY = 'meal-planner-auto-backup';
const CACHE_URL = 'auto-backup.json';

/** localStorage plus Cache Storage, so losing one still leaves the other. */
export const deviceStore: MirrorStore = {
  async read() {
    try {
      const v = localStorage.getItem(KEY);
      if (v) return v;
    } catch {
      /* blocked */
    }
    try {
      const res = await (await caches.open(KEY)).match(CACHE_URL);
      return res ? await res.text() : null;
    } catch {
      return null;
    }
  },
  async write(json) {
    try {
      localStorage.setItem(KEY, json);
    } catch {
      /* full or blocked */
    }
    try {
      await (await caches.open(KEY)).put(CACHE_URL, new Response(json, { headers: { 'content-type': 'application/json' } }));
    } catch {
      /* unavailable */
    }
  },
  async clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* blocked */
    }
    try {
      await caches.delete(KEY);
    } catch {
      /* unavailable */
    }
  },
};

const USER_TABLES = ['lots', 'loose', 'txns', 'meals', 'cookLogs', 'shopping', 'trips'] as const;
type Row = Record<string, unknown>;
const personalRecipe = (r: Row) => r.source !== 'builtin' || !!r.userEdited || !!r.favorite || !!r.archived || r.rating !== undefined;

/** Anything the user made: stock, plans, history, own/edited/rated recipes, settings. */
export function hasUserData(b: Backup): boolean {
  return (
    USER_TABLES.some((t) => b.tables[t].length > 0) ||
    b.tables.recipes.some(personalRecipe) ||
    b.tables.kv.some((r) => r.key === 'settings')
  );
}

/** Built-in recipes come back from the app itself, so the copy only keeps personal ones (and forces a re-seed). */
export function compactBackup(b: Backup): Backup {
  return {
    ...b,
    tables: {
      ...b.tables,
      recipes: b.tables.recipes.filter(personalRecipe),
      kv: b.tables.kv.filter((r) => r.key !== 'seedVersion' && r.key !== 'autoBackupAt'),
    },
  };
}

export type AutoBackupResult = 'saved' | 'restored' | 'empty';

export async function autoBackup(database: MealDB = db, store: MirrorStore = deviceStore): Promise<AutoBackupResult> {
  const current = await exportBackup(database);
  if (!hasUserData(current)) {
    const saved = await store.read().catch(() => null);
    if (!saved) return 'empty';
    try {
      const parsed = JSON.parse(saved) as Backup;
      if (!hasUserData(parsed)) return 'empty';
      await importBackup(saved, database);
      // importBackup stamps "last backup"; keep the real date of the last file backup instead
      const fileBackup = parsed.tables.kv.find((r) => r.key === 'lastBackupAt');
      if (fileBackup) await database.kv.put({ key: 'lastBackupAt', value: fileBackup.value });
      else await database.kv.delete('lastBackupAt');
      await database.kv.put({ key: 'autoRestoredAt', value: Date.now() });
      return 'restored';
    } catch {
      return 'empty';
    }
  }
  await store.write(JSON.stringify(compactBackup(current)));
  await database.kv.put({ key: 'autoBackupAt', value: Date.now() });
  return 'saved';
}
