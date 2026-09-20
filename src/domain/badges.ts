// Kitchen badges. Not gamification for its own sake — the useful ones measure the habits this
// app exists to build: cooking what you planned, using food up instead of binning it, and
// getting out of the same four dinners.
import type { CookLog, InventoryTxn, PlannedMeal, Recipe, Trip } from './types';

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  /** What it takes, in plain words. */
  goal: string;
  /** Where you are now. */
  progress: number;
  target: number;
  earned: boolean;
}

export interface BadgeInput {
  cookLogs: CookLog[];
  meals: PlannedMeal[];
  recipeById: Map<string, Recipe>;
  trips: Trip[];
  txns: InventoryTxn[];
  /** Longest run of consecutive cooking days, from `stats.streaks`. */
  bestStreak: number;
}

const pct = (n: number, target: number) => Math.min(1, target > 0 ? n / target : 0);

export function badges(input: BadgeInput): Badge[] {
  const { cookLogs, meals, recipeById, trips, txns, bestStreak } = input;

  const cooks = cookLogs.length;
  const distinct = new Set(cookLogs.map((l) => l.recipeId)).size;
  const cuisines = new Set(
    cookLogs.map((l) => recipeById.get(l.recipeId)?.cuisine).filter((c): c is string => !!c && c !== 'Other'),
  ).size;
  const planned = meals.filter((m) => m.status === 'cooked').length;
  const wasteCount = txns.filter((t) => t.reason === 'waste').length;
  const cookedSinceWaste = (() => {
    const lastWaste = Math.max(0, ...txns.filter((t) => t.reason === 'waste').map((t) => t.at));
    return cookLogs.filter((l) => l.at > lastWaste).length;
  })();

  const list: Omit<Badge, 'earned'>[] = [
    { id: 'first-cook', name: 'First light', emoji: '🔥', goal: 'Cook one meal from the app', progress: cooks, target: 1 },
    { id: 'ten-cooks', name: 'Regular', emoji: '🍳', goal: 'Cook ten meals', progress: cooks, target: 10 },
    { id: 'fifty-cooks', name: 'Home cook', emoji: '👨‍🍳', goal: 'Cook fifty meals', progress: cooks, target: 50 },
    { id: 'hundred-cooks', name: 'Century', emoji: '💯', goal: 'Cook a hundred meals', progress: cooks, target: 100 },
    { id: 'variety-15', name: 'Range', emoji: '🎨', goal: 'Cook fifteen different recipes', progress: distinct, target: 15 },
    { id: 'passport', name: 'Passport', emoji: '🌍', goal: 'Cook eight different cuisines', progress: cuisines, target: 8 },
    { id: 'streak-5', name: 'On a roll', emoji: '📆', goal: 'Cook five days in a row', progress: bestStreak, target: 5 },
    { id: 'streak-14', name: 'Fortnight', emoji: '🗓️', goal: 'Cook fourteen days in a row', progress: bestStreak, target: 14 },
    { id: 'stuck-to-plan', name: 'Stuck to the plan', emoji: '✅', goal: 'Cook twenty meals you planned', progress: planned, target: 20 },
    { id: 'no-waste-10', name: 'Nothing wasted', emoji: '♻️', goal: 'Ten cooks since the last thing you threw out', progress: cookedSinceWaste, target: 10 },
    { id: 'shopper', name: 'Provisioner', emoji: '🛒', goal: 'Finish ten shopping trips', progress: trips.length, target: 10 },
    { id: 'clean-record', name: 'Clean record', emoji: '🧹', goal: 'Get through a month without binning anything', progress: wasteCount === 0 ? 1 : 0, target: 1 },
  ];

  return list.map((b) => ({ ...b, earned: b.progress >= b.target }));
}

export const earnedCount = (list: Badge[]) => list.filter((b) => b.earned).length;

/** The one you are closest to finishing but have not earned — the thing worth nudging. */
export function nextBadge(list: Badge[]): Badge | undefined {
  return list
    .filter((b) => !b.earned)
    .sort((a, b) => pct(b.progress, b.target) - pct(a.progress, a.target))[0];
}
