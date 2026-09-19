// Splitting one shopping list across the two or three places you actually shop.
// Produce at the market, staples at the warehouse club, the rest wherever — the list knows,
// so you stop standing in an aisle wondering whether this was the Aldi item.
import { storeById, type StoreId } from './stores';
import type { AisleId } from './types';

export interface StoreAssignment {
  /** Which store each aisle defaults to. Aisles left out go to the primary store. */
  aisles: Partial<Record<AisleId, StoreId>>;
  /** Per-ingredient exceptions, which beat the aisle rule. */
  overrides: Record<string, StoreId>;
  primary: StoreId;
}

export function storeFor(
  assignment: StoreAssignment,
  line: { ingredientId?: string; aisle: AisleId },
): StoreId {
  const override = line.ingredientId ? assignment.overrides[line.ingredientId] : undefined;
  return override ?? assignment.aisles[line.aisle] ?? assignment.primary;
}

export interface StoreGroup<L> {
  store: StoreId;
  label: string;
  lines: L[];
}

/**
 * Group lines by store, primary store first and the rest alphabetically, so the order is
 * stable between renders. Empty stores are dropped.
 */
export function groupByStore<L extends { ingredientId?: string; aisle: AisleId }>(
  lines: L[],
  assignment: StoreAssignment,
): StoreGroup<L>[] {
  const buckets = new Map<StoreId, L[]>();
  for (const line of lines) {
    const id = storeFor(assignment, line);
    const bucket = buckets.get(id);
    if (bucket) bucket.push(line);
    else buckets.set(id, [line]);
  }
  return [...buckets]
    .map(([store, ls]) => ({ store, label: storeById(store)?.label ?? 'Store', lines: ls }))
    .sort((a, b) => {
      if (a.store === assignment.primary) return -1;
      if (b.store === assignment.primary) return 1;
      return a.label.localeCompare(b.label);
    });
}

/** Stores with at least one line, for the "3 stops" summary. */
export const storeStops = <L>(groups: StoreGroup<L>[]): number => groups.filter((g) => g.lines.length > 0).length;
