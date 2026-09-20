// Applying the fridge sweep. One transaction for the whole pass: every lot you kept gets a new
// date, everything you binned is logged as waste so the reports stay honest.
import { addDaysISO, todayISO } from '../domain/dates';
import type { SweepDecision } from '../domain/sweep';
import { db } from '../db/schema';
import { newId } from './ids';

export interface SweepOutcome {
  kept: number;
  tossed: number;
  /** Base units binned, so the screen can show what it cost. */
  tossedQty: number;
}

export async function applySweep(decisions: SweepDecision[], today = todayISO()): Promise<SweepOutcome> {
  const outcome: SweepOutcome = { kept: 0, tossed: 0, tossedQty: 0 };
  await db.transaction('rw', db.lots, db.txns, async () => {
    const now = Date.now();
    for (const d of decisions) {
      const lot = await db.lots.get(d.lotId);
      if (!lot) continue;
      if (d.verdict === 'keep') {
        await db.lots.update(lot.id, { expiresOn: addDaysISO(today, Math.max(1, d.extendDays ?? 3)) });
        outcome.kept += 1;
      } else if (d.verdict === 'toss') {
        await db.lots.delete(lot.id);
        await db.txns.add({
          id: newId(),
          ingredientId: lot.ingredientId,
          delta: -lot.qty,
          reason: 'waste',
          refId: lot.id,
          note: 'Fridge sweep',
          at: now,
        });
        outcome.tossed += 1;
        outcome.tossedQty += lot.qty;
      }
      // 'use-now' changes no stock — it only puts the recipe suggestion in front of you.
    }
  });
  return outcome;
}
