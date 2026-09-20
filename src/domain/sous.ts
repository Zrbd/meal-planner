// Splitting a cook between two people. The dinner timeline already knows which tasks can run in
// parallel; this assigns them to hands, so "you do the rice, I'll do the sauce" is written down
// instead of negotiated at the stove.
export interface SousTask {
  id: string;
  label: string;
  /** Minutes before serving that this starts. */
  startsAt: number;
  minutes: number;
  /** True for things that run on their own once started (simmering, resting, oven). */
  passive?: boolean;
  recipeId?: string;
}

export interface Assignment {
  cook: number;
  task: SousTask;
}

export interface SousPlan {
  cooks: number;
  lanes: Assignment[][];
  /** Tasks that could not be fitted without overlapping; shown as "one of you grab this". */
  unassigned: SousTask[];
  /** Minutes of hands-on work each cook carries, for the balance bar. */
  load: number[];
}

/**
 * Greedy interval assignment: walk tasks in start order and give each one to the cook who is
 * free and least loaded. Passive tasks cost a cook nothing after they start, so they only need
 * a free moment at the top.
 */
export function splitTasks(tasks: SousTask[], cooks = 2): SousPlan {
  const n = Math.max(1, Math.round(cooks));
  const lanes: Assignment[][] = Array.from({ length: n }, () => []);
  const load = new Array<number>(n).fill(0);
  const busyUntil = new Array<number>(n).fill(Number.POSITIVE_INFINITY);
  const unassigned: SousTask[] = [];

  // Timeline counts *down* to serving, so a bigger startsAt is earlier.
  const ordered = [...tasks].sort((a, b) => b.startsAt - a.startsAt);

  for (const task of ordered) {
    const cost = task.passive ? Math.min(2, task.minutes) : task.minutes;
    const endsAt = task.startsAt - cost;
    let pick = -1;
    for (let i = 0; i < n; i += 1) {
      if (busyUntil[i] < task.startsAt || busyUntil[i] === Number.POSITIVE_INFINITY) {
        if (pick === -1 || load[i] < load[pick]) pick = i;
      }
    }
    if (pick === -1) {
      unassigned.push(task);
      continue;
    }
    lanes[pick].push({ cook: pick, task });
    load[pick] += cost;
    busyUntil[pick] = endsAt;
  }

  return { cooks: n, lanes, unassigned, load };
}

/** 'Cook 1' / 'Cook 2', or names when the household set them. */
export function cookName(index: number, names: string[] | undefined): string {
  return names?.[index]?.trim() || `Cook ${index + 1}`;
}

/** How lopsided the split came out, 0 = even. Used to warn before you commit to it. */
export function imbalance(plan: SousPlan): number {
  if (plan.load.length < 2) return 0;
  const max = Math.max(...plan.load);
  const min = Math.min(...plan.load);
  return max > 0 ? (max - min) / max : 0;
}
