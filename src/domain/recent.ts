// The recipes you opened lately. Small, dumb, and surprisingly useful: half of all looking-up
// is looking up the same thing you looked up yesterday.
export const RECENT_LIMIT = 12;

export function parseRecent(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string').slice(0, RECENT_LIMIT) : [];
}

/** Most recent first, no duplicates, capped. */
export function pushRecent(list: string[], recipeId: string, limit = RECENT_LIMIT): string[] {
  return [recipeId, ...list.filter((id) => id !== recipeId)].slice(0, limit);
}
