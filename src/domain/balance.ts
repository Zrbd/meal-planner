// How varied a week actually is: proteins, cuisines, starches and effort.
// Pure scoring over the planned meals — the Plan screen renders it as a meter plus a few notes.
import { proteinTypeOf, starchesOf, type ProteinType } from './dishes';
import type { Ingredient, PlannedMeal, Recipe } from './types';

export interface BalanceNote {
  id: string;
  tone: 'good' | 'warn';
  text: string;
}

export interface WeekBalance {
  /** 0–100. Not a grade — a nudge. */
  score: number;
  meals: number;
  proteins: { type: ProteinType; count: number }[];
  cuisines: { cuisine: string; count: number }[];
  starches: { starch: string; count: number }[];
  /** Mains whose total time is over the weeknight limit. */
  longNights: number;
  repeats: { recipeId: string; title: string; count: number }[];
  notes: BalanceNote[];
}

const tally = <T>(xs: T[]): Map<T, number> => {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
};

const sorted = <T>(m: Map<T, number>) => [...m].sort((a, b) => b[1] - a[1]);

/** Share of the week taken by the single most common value, 0–1. */
const topShare = (m: Map<unknown, number>, total: number) =>
  total === 0 ? 0 : Math.max(0, ...[...m.values()]) / total;

const PROTEIN_LABEL: Record<ProteinType, string> = {
  chicken: 'chicken', turkey: 'turkey', pork: 'pork', fish: 'fish', shrimp: 'shrimp',
  beans: 'beans', tofu: 'tofu', eggs: 'eggs', meatless: 'meatless',
};

export function weekBalance(input: {
  meals: PlannedMeal[];
  recipeById: Map<string, Recipe>;
  ingById: Map<string, Ingredient>;
  /** Anything longer than this counts as a long night. Defaults to 45 minutes. */
  weeknightMaxMin?: number;
}): WeekBalance {
  const maxMin = input.weeknightMaxMin ?? 45;
  const mains: Recipe[] = [];
  for (const m of input.meals) {
    if (m.status === 'skipped' || m.leftoverOf) continue;
    const r = input.recipeById.get(m.recipeId);
    if (r && r.role !== 'side' && r.role !== 'dessert') mains.push(r);
  }

  const total = mains.length;
  const proteinMap = tally(mains.map((r) => proteinTypeOf(r, input.ingById)));
  const cuisineMap = tally(mains.map((r) => r.cuisine || 'Other'));
  const starchMap = tally(mains.flatMap((r) => [...starchesOf(r)]));
  const repeatMap = tally(mains.map((r) => r.id));
  const longNights = mains.filter((r) => r.prepMin + r.cookMin > maxMin).length;

  const notes: BalanceNote[] = [];
  const proteins = sorted(proteinMap).map(([type, count]) => ({ type, count }));
  const cuisines = sorted(cuisineMap).map(([cuisine, count]) => ({ cuisine, count }));
  const starches = sorted(starchMap).map(([starch, count]) => ({ starch, count }));
  const repeats = sorted(repeatMap)
    .filter(([, count]) => count > 1)
    .map(([recipeId, count]) => ({ recipeId, title: input.recipeById.get(recipeId)?.title ?? recipeId, count }));

  if (total >= 3) {
    const pShare = topShare(proteinMap, total);
    if (pShare >= 0.6 && proteins[0]) {
      notes.push({ id: 'protein', tone: 'warn', text: `${proteins[0].count} of ${total} dinners are ${PROTEIN_LABEL[proteins[0].type]}.` });
    } else if (proteins.length >= 3) {
      notes.push({ id: 'protein', tone: 'good', text: `${proteins.length} different proteins this week.` });
    }

    if (topShare(cuisineMap, total) >= 0.6 && cuisines[0]) {
      notes.push({ id: 'cuisine', tone: 'warn', text: `Heavy on ${cuisines[0].cuisine} — ${cuisines[0].count} of ${total}.` });
    } else if (cuisines.length >= 4) {
      notes.push({ id: 'cuisine', tone: 'good', text: `${cuisines.length} cuisines on the table.` });
    }

    if (starches[0] && starches[0].count >= Math.ceil(total * 0.75)) {
      notes.push({ id: 'starch', tone: 'warn', text: `${starches[0].starch} shows up ${starches[0].count} times.` });
    }

    const meatless = (proteinMap.get('meatless') ?? 0) + (proteinMap.get('beans') ?? 0) + (proteinMap.get('tofu') ?? 0);
    if (meatless === 0 && total >= 4) notes.push({ id: 'meatless', tone: 'warn', text: 'No meatless night this week.' });
    else if (meatless > 0) notes.push({ id: 'meatless', tone: 'good', text: `${meatless} meatless ${meatless === 1 ? 'night' : 'nights'}.` });
  }

  if (longNights > 0) {
    const weeknighty = longNights <= 2;
    notes.push({
      id: 'time',
      tone: weeknighty ? 'good' : 'warn',
      text: `${longNights} ${longNights === 1 ? 'dinner runs' : 'dinners run'} over ${maxMin} minutes.`,
    });
  }
  for (const rep of repeats) notes.push({ id: `repeat:${rep.recipeId}`, tone: 'warn', text: `${rep.title} is on twice.` });

  // Score: start full, take off for concentration in any one dimension and for a heavy week.
  let score = 100;
  if (total >= 3) {
    score -= Math.max(0, topShare(proteinMap, total) - 0.4) * 110;
    score -= Math.max(0, topShare(cuisineMap, total) - 0.5) * 70;
    score -= Math.max(0, topShare(starchMap, total) - 0.6) * 50;
    score -= repeats.reduce((s, r) => s + (r.count - 1) * 8, 0);
    score -= Math.max(0, longNights - 2) * 6;
  }
  return {
    score: total === 0 ? 0 : Math.max(0, Math.min(100, Math.round(score))),
    meals: total, proteins, cuisines, starches, longNights, repeats, notes,
  };
}
