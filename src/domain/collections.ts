// User-made recipe collections ("Weeknight wins", "Thanksgiving", "Dad's favorites").
// Stored as a single kv row; the pure helpers here keep the shape honest.
export interface Collection {
  id: string;
  name: string;
  emoji?: string;
  recipeIds: string[];
  createdAt: number;
  updatedAt: number;
}

export const COLLECTION_EMOJI = ['📚', '⭐️', '🔥', '🥗', '🍝', '🎉', '❄️', '🥘', '🍰', '🌶️'];

/** Tolerant parse — anything unrecognised in storage is dropped rather than crashing a screen. */
export function parseCollections(value: unknown): Collection[] {
  if (!Array.isArray(value)) return [];
  const out: Collection[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const c = raw as Partial<Collection>;
    if (typeof c.id !== 'string' || typeof c.name !== 'string') continue;
    out.push({
      id: c.id,
      name: c.name,
      emoji: typeof c.emoji === 'string' ? c.emoji : undefined,
      recipeIds: Array.isArray(c.recipeIds) ? c.recipeIds.filter((x): x is string => typeof x === 'string') : [],
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : 0,
      updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : 0,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function toggleMembership(list: Collection[], collectionId: string, recipeId: string, now: number): Collection[] {
  return list.map((c) => {
    if (c.id !== collectionId) return c;
    const has = c.recipeIds.includes(recipeId);
    return {
      ...c,
      recipeIds: has ? c.recipeIds.filter((x) => x !== recipeId) : [...c.recipeIds, recipeId],
      updatedAt: now,
    };
  });
}

/** Which collections a recipe belongs to. */
export function collectionsOf(list: Collection[], recipeId: string): Collection[] {
  return list.filter((c) => c.recipeIds.includes(recipeId));
}

/** Drop recipes that no longer exist, so a deleted recipe can't haunt a collection. */
export function pruneCollections(list: Collection[], liveRecipeIds: Set<string>): Collection[] {
  return list.map((c) => ({ ...c, recipeIds: c.recipeIds.filter((id) => liveRecipeIds.has(id)) }));
}
