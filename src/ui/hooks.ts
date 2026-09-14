import { useMemo } from 'react';
import { availableByIngredient, recipeCoverage, type Coverage } from '../domain/coverage';
import { computeAlerts } from '../domain/forecast';
import { dishTypeOf, equipmentOf, isFullMeal, proteinTypeOf, type DishType, type Equipment, type ProteinType } from '../domain/dishes';
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

export function useAlerts() {
  const d = useAppData();
  return useMemo(
    () =>
      computeAlerts({
        ingredients: d.ingById, recipes: d.recipeById, lots: d.lots, loose: d.loose, txns: d.txns, meals: d.meals,
        today: d.today, now: d.now, bufferDays: d.settings.bufferDays, shoppingDay: d.settings.shoppingDay,
      }),
    [d.ingById, d.recipeById, d.lots, d.loose, d.txns, d.meals, d.today, d.now, d.settings.bufferDays, d.settings.shoppingDay],
  );
}
