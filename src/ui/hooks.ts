import { useEffect, useMemo, useState } from 'react';
import { availableByIngredient, recipeCoverage, type Coverage } from '../domain/coverage';
import { computeAlerts } from '../domain/forecast';
import { dishTypeOf, equipmentOf, isFullMeal, proteinTypeOf, type DishType, type Equipment, type ProteinType } from '../domain/dishes';
import { prepTimeline } from '../domain/prep';
import { unitPrices } from '../domain/prices';
import type { LooseLevel } from '../domain/types';
import { useAppData } from './data';

export function useAvailability() {
  const { lots, loose, today } = useAppData();
  return useMemo(
    () => ({
      available: availableByIngredient(lots, today),
      looseLevel: new Map<string, LooseLevel>(loose.map((l) => [l.ingredientId, l.level])),
    }),
    [lots, loose, today],
  );
}

/** Coverage of every recipe at household size. */
export function useCoverage(): Map<string, Coverage> {
  const { recipes, ingById, settings } = useAppData();
  const { available, looseLevel } = useAvailability();
  return useMemo(
    () => new Map(recipes.map((r) => [r.id, recipeCoverage(r, settings.householdSize, available, looseLevel, ingById)])),
    [recipes, ingById, settings.householdSize, available, looseLevel],
  );
}

export interface DishInfo {
  dishType: DishType;
  protein: ProteinType;
  fullMeal: boolean;
  equipment: Equipment[];
}

/** Dish type, main protein, and cookware for every recipe. */
export function useDishInfo(): Map<string, DishInfo> {
  const { recipes, ingById } = useAppData();
  return useMemo(
    () =>
      new Map(
        recipes.map((r) => [
          r.id,
          { dishType: dishTypeOf(r, ingById), protein: proteinTypeOf(r, ingById), fullMeal: isFullMeal(r, ingById), equipment: equipmentOf(r) },
        ]),
      ),
    [recipes, ingById],
  );
}

/** The current time, ticking every couple of minutes so time-based alerts (thaw tonight, start marinating) appear on time. */
export function useClock(everyMs = 120_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, everyMs);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [everyMs]);
  return now;
}

export function useAlerts() {
  const d = useAppData();
  const clock = useClock();
  const now = Math.max(d.now, clock);
  return useMemo(
    () =>
      computeAlerts({
        ingredients: d.ingById, recipes: d.recipeById, lots: d.lots, loose: d.loose, txns: d.txns, meals: d.meals,
        today: d.today, now, bufferDays: d.settings.bufferDays, shoppingDay: d.settings.shoppingDay,
      }),
    [d.ingById, d.recipeById, d.lots, d.loose, d.txns, d.meals, d.today, now, d.settings.bufferDays, d.settings.shoppingDay],
  );
}

/** Thawing and prep steps (marinate, soak, rise, chill, rest) to start in the next two days. */
export function usePrepTimeline() {
  const d = useAppData();
  return useMemo(
    () => prepTimeline({ meals: d.meals, recipesById: d.recipeById, ingById: d.ingById, lots: d.lots, loose: d.loose, today: d.today, horizonDays: 2 }),
    [d.meals, d.recipeById, d.ingById, d.lots, d.loose, d.today],
  );
}

/** Latest price paid per base unit, from shopping trips. */
export function usePrices(): Map<string, number> {
  const { trips } = useAppData();
  return useMemo(() => unitPrices(trips), [trips]);
}
