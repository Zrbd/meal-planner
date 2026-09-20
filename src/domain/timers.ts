// Kitchen timers that outlive the screen you started them on.
//
// Cook mode can already count down a single step, but real cooking is three things at once —
// rice on, chicken in, timer for the garlic. These are plain records with an end time, so they
// stay correct across a reload, a backgrounded tab, or a walk to the other room.
export interface KitchenTimer {
  id: string;
  label: string;
  /** Total length in seconds, used to draw the progress ring. */
  seconds: number;
  /** Epoch ms when it will fire. */
  endsAt: number;
  /** Set while paused; seconds still to go. */
  pausedWith?: number;
  /** Where it came from, so tapping it can go back there. */
  recipeId?: string;
  createdAt: number;
}

export const MAX_TIMERS = 8;

export function parseTimers(value: unknown): KitchenTimer[] {
  if (!Array.isArray(value)) return [];
  const out: KitchenTimer[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const t = raw as Partial<KitchenTimer>;
    if (typeof t.id !== 'string' || typeof t.endsAt !== 'number' || typeof t.seconds !== 'number') continue;
    out.push({
      id: t.id,
      label: typeof t.label === 'string' && t.label ? t.label : 'Timer',
      seconds: Math.max(1, Math.round(t.seconds)),
      endsAt: t.endsAt,
      pausedWith: typeof t.pausedWith === 'number' ? t.pausedWith : undefined,
      recipeId: typeof t.recipeId === 'string' ? t.recipeId : undefined,
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : t.endsAt,
    });
  }
  return out.slice(0, MAX_TIMERS);
}

export const isPaused = (t: KitchenTimer) => t.pausedWith !== undefined;

/** Seconds left, never negative. A paused timer holds its remaining time. */
export function remaining(t: KitchenTimer, now: number): number {
  if (t.pausedWith !== undefined) return Math.max(0, t.pausedWith);
  return Math.max(0, Math.round((t.endsAt - now) / 1000));
}

export const isDone = (t: KitchenTimer, now: number) => remaining(t, now) === 0 && !isPaused(t);

export function pause(t: KitchenTimer, now: number): KitchenTimer {
  if (isPaused(t)) return t;
  return { ...t, pausedWith: remaining(t, now) };
}

export function resume(t: KitchenTimer, now: number): KitchenTimer {
  if (!isPaused(t)) return t;
  return { ...t, endsAt: now + (t.pausedWith ?? 0) * 1000, pausedWith: undefined };
}

/** Add or subtract time without losing the ring's sense of scale. */
export function nudge(t: KitchenTimer, deltaSec: number, now: number): KitchenTimer {
  const left = Math.max(0, remaining(t, now) + deltaSec);
  const seconds = Math.max(t.seconds, left);
  return isPaused(t) ? { ...t, pausedWith: left, seconds } : { ...t, endsAt: now + left * 1000, seconds };
}

/** 0 to 1, for the progress ring. */
export const progress = (t: KitchenTimer, now: number) =>
  t.seconds <= 0 ? 1 : Math.min(1, Math.max(0, 1 - remaining(t, now) / t.seconds));

export function formatLeft(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Common lengths offered when you add a timer by hand. */
export const QUICK_TIMERS: { label: string; seconds: number }[] = [
  { label: '1 min', seconds: 60 },
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '15 min', seconds: 900 },
  { label: '20 min', seconds: 1200 },
  { label: '30 min', seconds: 1800 },
  { label: '45 min', seconds: 2700 },
  { label: '1 hour', seconds: 3600 },
];
