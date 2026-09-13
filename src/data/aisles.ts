import type { AisleId } from '../domain/types';

export const AISLES: { id: AisleId; label: string; emoji: string }[] = [
  { id: 'produce', label: 'Produce', emoji: '🥬' },
  { id: 'meat', label: 'Meat', emoji: '🥩' },
  { id: 'seafood', label: 'Seafood', emoji: '🐟' },
  { id: 'dairy', label: 'Dairy & Eggs', emoji: '🥚' },
  { id: 'bakery', label: 'Bakery & Tortillas', emoji: '🥖' },
  { id: 'frozen', label: 'Frozen', emoji: '🧊' },
  { id: 'canned', label: 'Canned & Jarred', emoji: '🥫' },
  { id: 'pasta-grains', label: 'Pasta, Rice & Grains', emoji: '🍝' },
  { id: 'baking', label: 'Baking', emoji: '🧁' },
  { id: 'spices', label: 'Spices', emoji: '🧂' },
  { id: 'oils-condiments', label: 'Oils & Condiments', emoji: '🫒' },
  { id: 'international', label: 'International', emoji: '🥢' },
  { id: 'snacks', label: 'Snacks & Nuts', emoji: '🥜' },
  { id: 'beverages', label: 'Beverages', emoji: '🧃' },
  { id: 'other', label: 'Other', emoji: '🛒' },
];

export const DEFAULT_AISLE_ORDER: AisleId[] = AISLES.map((a) => a.id);

export const aisleLabel = (id: AisleId) => AISLES.find((a) => a.id === id)?.label ?? 'Other';
export const aisleEmoji = (id: AisleId) => AISLES.find((a) => a.id === id)?.emoji ?? '🛒';
