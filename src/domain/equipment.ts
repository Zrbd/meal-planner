// Which gear you actually own. The app already reads equipment out of a recipe's steps; this
// layer is the other half — you tick what is in your kitchen once, and recipes that need the
// stand mixer you do not have stop showing up first.
import { equipmentOf } from './dishes';
import type { Equipment } from './dishes';
import type { Recipe } from './types';

/**
 * Assumed present unless you say otherwise. Almost every kitchen has a pot and a pan, so
 * defaulting these off would bury the entire recipe list behind a settings chore.
 */
export const ASSUMED_OWNED = ['large-pot', 'saucepan', 'skillet', 'sheet-pan', 'baking-dish', 'mixing-bowl'];

/** Gear that is genuinely optional, and worth asking about. */
export const OPTIONAL_EQUIPMENT = ['wok', 'rice-cooker', 'slow-cooker', 'pressure-cooker', 'air-fryer', 'grill', 'blender', 'muffin-tin'];

export function parseOwned(value: unknown): string[] {
  if (!Array.isArray(value)) return [...ASSUMED_OWNED, ...OPTIONAL_EQUIPMENT];
  const ids = value.filter((v): v is string => typeof v === 'string');
  // The assumed-present set is never removable; the toggles only cover the optional gear.
  return [...new Set([...ASSUMED_OWNED, ...ids])];
}

export interface EquipmentCheck {
  needed: Equipment[];
  missing: Equipment[];
  ok: boolean;
}

export function checkEquipment(recipe: Recipe, owned: string[]): EquipmentCheck {
  const ownedSet = new Set(owned);
  const needed = equipmentOf(recipe);
  const missing = needed.filter((e) => !ownedSet.has(e.id));
  return { needed, missing, ok: missing.length === 0 };
}

/** "Needs an air fryer you don't have" — the warning on the recipe card. */
export function describeMissing(check: EquipmentCheck): string | undefined {
  if (check.ok) return undefined;
  const names = check.missing.map((e) => e.label.toLowerCase());
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Needs ${list} — not in your kitchen list`;
}

/** Filter for the browse screen, when "only what I can cook" is on. */
export function canCookWith(recipe: Recipe, owned: string[]): boolean {
  return checkEquipment(recipe, owned).ok;
}
