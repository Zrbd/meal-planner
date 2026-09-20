// Dinner roulette: "just pick something." A weighted draw rather than a flat random one, so
// the wheel leans toward things you can actually cook tonight and away from what you ate on
// Tuesday. Pure and seedable, so a test can pin the result.
import { mulberry32 } from './autoplan';
import type { Coverage } from './coverage';
import { lastCooked } from './rotation';
import type { CookLog, ISODate, PlannedMeal, Recipe } from './types';

export interface RouletteInput {
  recipes: Recipe[];
  coverage: Map<string, Coverage>;
  cookLogs: CookLog[];
  meals: PlannedMeal[];
  today: ISODate;
  now: number;
  /** Only draw from these recipe ids, when the user narrowed the wheel. */
  pool?: Set<string>;
  /** Cap on total time, in minutes. */
  maxMinutes?: number;
  seed?: number;
}

export interface RouletteEntry {
  recipe: Recipe;
  weight: number;
  /** Why it is weighted the way it is, shown under the result. */
  reasons: string[];
}

const DAY = 86_400_000;

/** Everything eligible, with a weight. Exported so the wheel can show its own odds. */
export function rouletteWheel(input: RouletteInput): RouletteEntry[] {
  const { recipes, coverage, cookLogs, meals, now, maxMinutes, pool } = input;
  const last = lastCooked(cookLogs);
  const planned = new Set(meals.filter((m) => m.date >= input.today && m.status === 'planned').map((m) => m.recipeId));

  const out: RouletteEntry[] = [];
  for (const r of recipes) {
    if (r.archived) continue;
    if (pool && !pool.has(r.id)) continue;
    if (maxMinutes && r.prepMin + r.cookMin > maxMinutes) continue;
    if (planned.has(r.id)) continue;

    let weight = 1;
    const reasons: string[] = [];

    const cov = coverage.get(r.id);
    if (cov?.canMake) {
      weight *= 3;
      reasons.push('you have everything');
    } else if (cov && cov.ratio >= 0.8) {
      weight *= 1.6;
      reasons.push('almost everything on hand');
    }

    if (r.favorite) {
      weight *= 1.5;
      reasons.push('a favorite');
    }
    if (r.rating && r.rating >= 4) weight *= 1.3;

    const when = last.get(r.id);
    if (when === undefined) {
      weight *= 1.4;
      reasons.push('never made it');
    } else {
      const days = (now - when) / DAY;
      if (days < 10) {
        weight *= 0.25;
        reasons.push(`made ${Math.round(days)} days ago`);
      } else if (days > 60) {
        weight *= 1.5;
        reasons.push('not made in months');
      }
    }

    if (weight > 0) out.push({ recipe: r, weight, reasons });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

/** Draw one. Returns undefined only when nothing at all is eligible. */
export function spin(input: RouletteInput): RouletteEntry | undefined {
  const wheel = rouletteWheel(input);
  if (!wheel.length) return undefined;
  const rand = mulberry32(input.seed ?? Math.floor(Math.random() * 2 ** 31));
  const total = wheel.reduce((n, e) => n + e.weight, 0);
  let ticket = rand() * total;
  for (const entry of wheel) {
    ticket -= entry.weight;
    if (ticket <= 0) return entry;
  }
  return wheel[wheel.length - 1];
}

/** A handful of different answers, for the "no, something else" button. */
export function spinMany(input: RouletteInput, count: number): RouletteEntry[] {
  const wheel = rouletteWheel(input);
  const rand = mulberry32(input.seed ?? Math.floor(Math.random() * 2 ** 31));
  const left = [...wheel];
  const out: RouletteEntry[] = [];
  while (out.length < count && left.length) {
    const total = left.reduce((n, e) => n + e.weight, 0);
    let ticket = rand() * total;
    let idx = left.length - 1;
    for (let i = 0; i < left.length; i += 1) {
      ticket -= left[i].weight;
      if (ticket <= 0) {
        idx = i;
        break;
      }
    }
    out.push(left[idx]);
    left.splice(idx, 1);
  }
  return out;
}
