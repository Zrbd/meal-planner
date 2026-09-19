// Cook journal: a short note (and rating) about how a recipe actually went.
export interface JournalEntry {
  id: string;
  recipeId: string;
  at: number;
  note: string;
  rating?: number;
  /** Servings you actually made, when it differed from the plan. */
  servings?: number;
}

export function parseJournal(value: unknown): JournalEntry[] {
  if (!Array.isArray(value)) return [];
  const out: JournalEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Partial<JournalEntry>;
    if (typeof e.id !== 'string' || typeof e.recipeId !== 'string' || typeof e.at !== 'number') continue;
    out.push({
      id: e.id,
      recipeId: e.recipeId,
      at: e.at,
      note: typeof e.note === 'string' ? e.note : '',
      rating: typeof e.rating === 'number' ? e.rating : undefined,
      servings: typeof e.servings === 'number' ? e.servings : undefined,
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

export function entriesFor(list: JournalEntry[], recipeId: string): JournalEntry[] {
  return list.filter((e) => e.recipeId === recipeId);
}

/** Average of the ratings people have left in the journal, if any. */
export function journalRating(list: JournalEntry[], recipeId: string): number | undefined {
  const rated = entriesFor(list, recipeId).map((e) => e.rating).filter((r): r is number => !!r);
  if (!rated.length) return undefined;
  return rated.reduce((a, b) => a + b, 0) / rated.length;
}
