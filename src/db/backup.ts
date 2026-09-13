// Full JSON backup / restore. iOS can evict PWA storage, so backups matter.
import { z } from 'zod';
import { ALL_TABLES, db, type MealDB } from './schema';
import { seedIfNeeded } from './seed';

const BackupSchema = z.object({
  app: z.literal('meal-planner'),
  version: z.number(),
  exportedAt: z.number(),
  tables: z.object(Object.fromEntries(ALL_TABLES.map((t) => [t, z.array(z.record(z.string(), z.unknown()))]))),
});
export type Backup = z.infer<typeof BackupSchema>;

export async function exportBackup(database: MealDB = db): Promise<Backup> {
  const tables: Record<string, unknown[]> = {};
  for (const t of ALL_TABLES) tables[t] = await database.table(t).toArray();
  return { app: 'meal-planner', version: 1, exportedAt: Date.now(), tables } as Backup;
}

export async function importBackup(json: string, database: MealDB = db): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const result = BackupSchema.safeParse(parsed);
  if (!result.success) throw new Error("That doesn't look like a Meal Planner backup.");
  const backup = result.data;
  await database.transaction('rw', ALL_TABLES.map((t) => database.table(t)), async () => {
    for (const t of ALL_TABLES) {
      await database.table(t).clear();
      await database.table(t).bulkAdd(backup.tables[t]);
    }
  });
  await database.kv.put({ key: 'lastBackupAt', value: backup.exportedAt });
}

/** Share the backup file (iOS share sheet) or fall back to a download. */
export async function shareBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const backup = await exportBackup();
  const name = `meal-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(backup)], name, { type: 'application/json' });
  let outcome: 'shared' | 'downloaded' | 'cancelled';
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Meal Planner backup' });
      outcome = 'shared';
    } catch {
      return 'cancelled';
    }
  } else {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    outcome = 'downloaded';
  }
  await db.kv.put({ key: 'lastBackupAt', value: Date.now() });
  return outcome;
}

export async function resetEverything(database: MealDB = db): Promise<void> {
  await database.transaction('rw', ALL_TABLES.map((t) => database.table(t)), async () => {
    for (const t of ALL_TABLES) await database.table(t).clear();
  });
  await seedIfNeeded(database);
}
