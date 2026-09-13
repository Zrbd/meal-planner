import { DEFAULT_AISLE_ORDER } from '../data/aisles';
import type { Settings } from '../domain/types';
import { db } from './schema';

export const DEFAULT_SETTINGS: Settings = {
  householdSize: 2,
  units: 'us',
  weekStartsOn: 0,
  shoppingDay: 0,
  enabledSlots: ['dinner'],
  mealsPerWeek: { breakfast: 0, lunch: 0, dinner: 5 },
  weeknightMaxMin: 45,
  dietFilters: [],
  dislikedIngredients: [],
  aisleOrder: DEFAULT_AISLE_ORDER,
  bufferDays: 3,
  notifications: false,
};

export function withDefaults(s: Partial<Settings> | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...(s ?? {}), mealsPerWeek: { ...DEFAULT_SETTINGS.mealsPerWeek, ...(s?.mealsPerWeek ?? {}) } };
}

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  return withDefaults(row?.value as Partial<Settings> | undefined);
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const current = await getSettings();
    await db.kv.put({ key: 'settings', value: { ...current, ...patch } });
  });
}
