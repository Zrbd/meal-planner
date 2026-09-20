// Notes on the things you buy: which brand of tortillas is the good one, which aisle the fish
// sauce hides in at the store on the corner, how long the open jar really lasts. Attached to the
// catalog ingredient, so they surface on the shopping list and in the pantry at the same time.
export interface IngredientNote {
  /** The brand you settled on. */
  brand?: string;
  /** Where it lives in *your* store, when it is somewhere unexpected. */
  where?: string;
  /** Free text: "the green cap one", "don't buy the low-sodium". */
  note?: string;
  /** Your own opened shelf life, in days — overrides the catalog's guess. */
  openedDays?: number;
  /** Never buy this again. */
  avoid?: boolean;
  updatedAt: number;
}

export type NoteMap = Record<string, IngredientNote>;

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined;

export function parseNotes(value: unknown): NoteMap {
  if (!value || typeof value !== 'object') return {};
  const out: NoteMap = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const n = raw as Partial<IngredientNote>;
    const note: IngredientNote = {
      brand: str(n.brand),
      where: str(n.where),
      note: str(n.note),
      openedDays: typeof n.openedDays === 'number' && n.openedDays > 0 ? Math.round(n.openedDays) : undefined,
      avoid: n.avoid === true || undefined,
      updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now(),
    };
    if (isEmpty(note)) continue;
    out[id] = note;
  }
  return out;
}

export function isEmpty(n: IngredientNote): boolean {
  return !n.brand && !n.where && !n.note && !n.openedDays && !n.avoid;
}

/** Writing an empty note removes the row rather than leaving a husk behind. */
export function setNote(map: NoteMap, ingredientId: string, patch: Omit<IngredientNote, 'updatedAt'>, at: number): NoteMap {
  const next = { ...map };
  const merged: IngredientNote = { ...patch, updatedAt: at };
  if (isEmpty(merged)) delete next[ingredientId];
  else next[ingredientId] = merged;
  return next;
}

/** One line for the shopping list: "Kikkoman · international aisle, bottom shelf". */
export function shoppingHint(n: IngredientNote | undefined): string | undefined {
  if (!n) return undefined;
  const bits = [n.brand, n.where, n.note].filter(Boolean);
  if (n.avoid) bits.unshift('Avoid');
  return bits.length ? bits.join(' · ') : undefined;
}
