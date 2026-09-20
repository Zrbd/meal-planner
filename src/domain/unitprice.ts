// Standing in the aisle with two boxes: which one is actually cheaper?
//
// Shelf tags are supposed to answer this and half of them are per-ounce while the one next to
// it is per-100-count. This normalizes everything to the ingredient's own base unit, then
// prints a comparison in a unit a person recognizes.
import { fromBase, toBase, formatNumber } from './units';
import type { Ingredient } from './types';

export interface PriceOption {
  id: string;
  label: string;
  /** What the package costs, in dollars. */
  price: number;
  /** How much is in it, in the entered unit. */
  qty: number;
  unit: string;
}

export interface PriceComparison {
  option: PriceOption;
  /** Dollars per one base unit (g / ml / each). */
  perBase: number;
  /** Dollars per display unit, e.g. per pound. */
  perDisplay: number;
  /** How much more it costs than the winner, as a fraction: 0.18 = 18% more. */
  premium: number;
  best: boolean;
}

export interface ComparisonResult {
  rows: PriceComparison[];
  /** The unit the comparison is printed in, e.g. 'lb'. */
  displayUnit: string;
  /** How much you save per display unit by taking the best one over the worst. */
  spread: number;
}

/** A unit people compare prices in, for each kind of thing. */
export function comparisonUnit(ing: Ingredient, system: 'us' | 'metric'): string {
  if (ing.baseUnit === 'ea') return 'ea';
  if (ing.baseUnit === 'ml') return system === 'us' ? 'fl oz' : 'l';
  return system === 'us' ? 'lb' : 'kg';
}

/**
 * Compare two or more packages of the same ingredient. Options that cannot be converted
 * (a unit the ingredient does not know) are dropped rather than silently mis-ranked.
 */
export function comparePrices(
  options: PriceOption[],
  ing: Ingredient,
  system: 'us' | 'metric' = 'us',
): ComparisonResult {
  const displayUnit = comparisonUnit(ing, system);
  const scored: { option: PriceOption; perBase: number }[] = [];
  for (const o of options) {
    if (!(o.price > 0) || !(o.qty > 0)) continue;
    let base: number;
    try {
      base = toBase(o.qty, o.unit, ing);
    } catch {
      continue;
    }
    if (!(base > 0)) continue;
    scored.push({ option: o, perBase: o.price / base });
  }
  if (!scored.length) return { rows: [], displayUnit, spread: 0 };

  scored.sort((a, b) => a.perBase - b.perBase);
  const best = scored[0].perBase;
  const perDisplayOf = (perBase: number) => {
    const oneDisplayInBase = toBase(1, displayUnit, ing);
    return perBase * oneDisplayInBase;
  };
  const rows = scored.map((s, i) => ({
    option: s.option,
    perBase: s.perBase,
    perDisplay: perDisplayOf(s.perBase),
    premium: best > 0 ? s.perBase / best - 1 : 0,
    best: i === 0,
  }));
  const spread = rows.length > 1 ? rows[rows.length - 1].perDisplay - rows[0].perDisplay : 0;
  return { rows, displayUnit, spread };
}

/** "$3.48 / lb" */
export function formatPerUnit(perDisplay: number, unit: string): string {
  const cents = perDisplay < 1 ? perDisplay.toFixed(3) : perDisplay.toFixed(2);
  return `$${cents} / ${unit === 'ea' ? 'each' : unit}`;
}

/** How much of a package you would actually finish before it went off, as a sanity check. */
export function usableFraction(
  qtyBase: number,
  dailyRate: number,
  shelfLifeDays: number | undefined,
): number {
  if (!shelfLifeDays || dailyRate <= 0) return 1;
  const canUse = dailyRate * shelfLifeDays;
  return Math.min(1, canUse / qtyBase);
}

/** The bigger box is only cheaper if you finish it; this is the price of what you eat. */
export function effectivePerBase(perBase: number, usable: number): number {
  return usable > 0 ? perBase / usable : Infinity;
}

/** Turn a base amount back into something readable for the summary line. */
export function describeSize(ing: Ingredient, base: number, unit: string): string {
  return `${formatNumber(fromBase(base, unit, ing))} ${unit}`;
}
