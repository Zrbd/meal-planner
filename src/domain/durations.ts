// "45 minutes" on a recipe card is the author's kitchen, not yours. Cook mode times how long you
// actually take, and after a couple of goes the card starts quoting your number instead.
export interface DurationRecord {
  /** Wall-clock minutes from opening cook mode to marking it cooked. */
  minutes: number;
  at: number;
}

export type DurationMap = Record<string, DurationRecord[]>;

export const MAX_SAMPLES = 8;
/** Below this, the card keeps quoting the recipe. Two samples is a coincidence. */
export const MIN_CONFIDENT = 3;

export function parseDurations(value: unknown): DurationMap {
  if (!value || typeof value !== 'object') return {};
  const out: DurationMap = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(raw)) continue;
    const recs = raw
      .map((r) => r as Partial<DurationRecord>)
      .filter((r): r is DurationRecord => typeof r?.minutes === 'number' && r.minutes > 0 && typeof r.at === 'number')
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_SAMPLES);
    if (recs.length) out[id] = recs;
  }
  return out;
}

export function record(map: DurationMap, recipeId: string, minutes: number, at: number): DurationMap {
  // A cook-mode session left open overnight is not a data point.
  if (!(minutes > 0) || minutes > 12 * 60) return map;
  const next = [{ minutes: Math.round(minutes), at }, ...(map[recipeId] ?? [])].slice(0, MAX_SAMPLES);
  return { ...map, [recipeId]: next };
}

export interface Typical {
  minutes: number;
  samples: number;
  confident: boolean;
  /** Difference from the recipe's own estimate, in minutes. Positive = slower than the card. */
  delta: number;
}

/** Median, not mean: one night where the phone rang should not move the number. */
export function typicalMinutes(map: DurationMap, recipeId: string, cardMinutes: number): Typical | undefined {
  const recs = map[recipeId];
  if (!recs?.length) return undefined;
  const sorted = recs.map((r) => r.minutes).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const minutes = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return { minutes, samples: sorted.length, confident: sorted.length >= MIN_CONFIDENT, delta: minutes - cardMinutes };
}

/** "You usually take 1 h 5 m — about 20 min longer than the card." */
export function describeTypical(t: Typical): string {
  const h = Math.floor(t.minutes / 60);
  const m = t.minutes % 60;
  const time = h ? `${h} h${m ? ` ${m} m` : ''}` : `${m} min`;
  if (Math.abs(t.delta) < 5) return `You usually take about ${time}, close to the card.`;
  const dir = t.delta > 0 ? 'longer' : 'quicker';
  return `You usually take ${time} — about ${Math.abs(t.delta)} min ${dir} than the card.`;
}

/** The planner should budget your time, not the author's. */
export function plannedMinutes(map: DurationMap, recipeId: string, cardMinutes: number): number {
  const t = typicalMinutes(map, recipeId, cardMinutes);
  return t?.confident ? t.minutes : cardMinutes;
}
