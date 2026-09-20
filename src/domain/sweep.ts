// The guided fridge sweep. Alerts tell you something expired; this walks you through the pile
// one item at a time and asks the only three questions that matter — still fine, use it now, or
// it's gone — and logs what went in the bin so the waste report has real numbers.
import { daysBetween } from './dates';
import { formatQty } from './units';
import type { Ingredient, ISODate, StockLot } from './types';

export type SweepVerdict = 'keep' | 'use-now' | 'toss';

export interface SweepItem {
  lot: StockLot;
  ing: Ingredient | undefined;
  /** Negative means already past the date. */
  daysLeft: number;
  /** Roughly what it cost, when we know a price. */
  value?: number;
  label: string;
  urgency: 'expired' | 'today' | 'soon';
}

export interface SweepDecision {
  lotId: string;
  verdict: SweepVerdict;
  /** For 'keep', push the date out by this many days. */
  extendDays?: number;
}

/** Everything worth looking at, worst first. */
export function buildSweep(
  lots: StockLot[],
  ingById: Map<string, Ingredient>,
  today: ISODate,
  horizonDays = 3,
): SweepItem[] {
  const out: SweepItem[] = [];
  for (const lot of lots) {
    if (!lot.expiresOn || lot.qty <= 0) continue;
    const daysLeft = daysBetween(today, lot.expiresOn);
    if (daysLeft > horizonDays) continue;
    const ing = ingById.get(lot.ingredientId);
    out.push({
      lot,
      ing,
      daysLeft,
      label: ing ? `${formatQty(lot.qty, ing)} ${ing.name}` : 'Unknown item',
      urgency: daysLeft < 0 ? 'expired' : daysLeft === 0 ? 'today' : 'soon',
    });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || (b.lot.qty ?? 0) - (a.lot.qty ?? 0));
}

export interface SweepSummary {
  kept: number;
  useNow: number;
  tossed: number;
  /** Base units binned, per ingredient, for the waste log. */
  tossedByIngredient: Map<string, number>;
}

export function summarize(items: SweepItem[], decisions: Map<string, SweepDecision>): SweepSummary {
  const summary: SweepSummary = { kept: 0, useNow: 0, tossed: 0, tossedByIngredient: new Map() };
  for (const item of items) {
    const d = decisions.get(item.lot.id);
    if (!d) continue;
    if (d.verdict === 'keep') summary.kept += 1;
    else if (d.verdict === 'use-now') summary.useNow += 1;
    else {
      summary.tossed += 1;
      const cur = summary.tossedByIngredient.get(item.lot.ingredientId) ?? 0;
      summary.tossedByIngredient.set(item.lot.ingredientId, cur + item.lot.qty);
    }
  }
  return summary;
}

/**
 * A sensible extension when you say "this is still fine": half the original shelf life, capped,
 * because a smell test buys you days, not another full run.
 */
export function suggestedExtension(ing: Ingredient | undefined, lot: StockLot): number {
  const base = ing?.shelfLife?.[lot.location] ?? 7;
  return Math.max(1, Math.min(14, Math.round(base / 2)));
}

/** "3 kept, 1 to cook tonight, 2 binned" */
export function describeSummary(s: SweepSummary): string {
  const bits: string[] = [];
  if (s.kept) bits.push(`${s.kept} kept`);
  if (s.useNow) bits.push(`${s.useNow} to cook soon`);
  if (s.tossed) bits.push(`${s.tossed} binned`);
  return bits.length ? bits.join(', ') : 'Nothing to sweep';
}
