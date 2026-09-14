import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { RECIPES } from '../src/data/recipes';
import { autoBackup, type MirrorStore } from '../src/db/autobackup';
import { db } from '../src/db/schema';
import { seedIfNeeded } from '../src/db/seed';
import { getSettings, updateSettings } from '../src/db/settings';

function memoryStore(): MirrorStore & { value: string | null } {
  return {
    value: null,
    async read() { return this.value; },
    async write(json) { this.value = json; },
    async clear() { this.value = null; },
  };
}

const wipe = async () => {
  await db.delete();
  await db.open();
  await seedIfNeeded();
};

beforeEach(wipe);

describe('auto backup', () => {
  it('does nothing on a brand-new install', async () => {
    const store = memoryStore();
    expect(await autoBackup(db, store)).toBe('empty');
    expect(store.value).toBeNull();
  });

  it('saves a compact copy and restores it after data loss', async () => {
    const store = memoryStore();
    await updateSettings({ householdSize: 3 });
    await db.meals.put({ id: 'm1', recipeId: RECIPES[0].id, date: '2026-09-15', slot: 'dinner', servings: 3, status: 'planned' });
    await db.recipes.update(RECIPES[1].id, { favorite: true });

    expect(await autoBackup(db, store)).toBe('saved');
    const saved = JSON.parse(store.value!);
    expect(saved.tables.recipes.length).toBe(1); // built-ins come back from the app, only personal ones are kept
    expect(await db.kv.get('autoBackupAt')).toBeTruthy();

    await wipe(); // the phone cleared the app's storage
    expect(await autoBackup(db, store)).toBe('restored');
    await seedIfNeeded();

    expect(await db.meals.count()).toBe(1);
    expect((await getSettings()).householdSize).toBe(3);
    expect(await db.recipes.count()).toBe(RECIPES.length);
    expect((await db.recipes.get(RECIPES[1].id))?.favorite).toBe(true);
    expect(await db.kv.get('autoRestoredAt')).toBeTruthy();
    expect(await db.kv.get('lastBackupAt')).toBeUndefined();
  });

  it('a cleared copy means a reset stays reset', async () => {
    const store = memoryStore();
    await updateSettings({ householdSize: 3 });
    await autoBackup(db, store);
    await store.clear();
    await wipe();
    expect(await autoBackup(db, store)).toBe('empty');
    expect(await db.meals.count()).toBe(0);
  });
});
