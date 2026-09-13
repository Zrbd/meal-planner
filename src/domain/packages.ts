// Pack-size optimizer: stores sell fixed sizes, so round a need up to real packages.
import type { Package } from './types';

export interface PackChoice {
  items: { label: string; qty: number; count: number }[];
  total: number; // baseUnit actually bought
}

/**
 * Choose the package combination with the least overbuy (tie → fewer packages).
 * `tolerance` lets a need slightly above a package still round to it (1.5 lb vs a 680 g pack).
 */
export function choosePackages(need: number, packages: Package[], tolerance = 0.03): PackChoice {
  if (need <= 1e-9) return { items: [], total: 0 };
  const sizes = packages.filter((p) => p.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 4);
  if (!sizes.length) return { items: [], total: need };

  const target = need * (1 - tolerance);
  let best: { counts: number[]; total: number; n: number } | null = null;
  const counts = new Array<number>(sizes.length).fill(0);

  const rec = (i: number, sum: number) => {
    const size = sizes[i].qty;
    if (i === sizes.length - 1) {
      const c = Math.max(0, Math.ceil((target - sum) / size - 1e-9));
      const total = sum + c * size;
      const n = counts.slice(0, i).reduce((a, b) => a + b, 0) + c;
      if (
        !best ||
        total < best.total - 1e-6 ||
        (Math.abs(total - best.total) <= 1e-6 && n < best.n)
      ) {
        best = { counts: [...counts.slice(0, i), c], total, n };
      }
      return;
    }
    const max = Math.min(Math.max(0, Math.ceil((target - sum) / size - 1e-9)), 60);
    for (let c = max; c >= 0; c--) {
      counts[i] = c;
      rec(i + 1, sum + c * size);
    }
    counts[i] = 0;
  };
  rec(0, 0);

  const chosen = best!;
  return {
    items: sizes
      .map((s, i) => ({ label: s.label, qty: s.qty, count: chosen.counts[i] }))
      .filter((x) => x.count > 0),
    total: chosen.total,
  };
}

export function describePackages(choice: PackChoice): string {
  return choice.items.map((i) => `${i.count} × ${i.label}`).join(' + ');
}
