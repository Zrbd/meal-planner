import { describe, expect, it } from 'vitest';
import { INGREDIENTS } from '../src/data/ingredients';
import { RECIPES } from '../src/data/recipes';
import { toBase } from '../src/domain/units';
import { ingById } from './helpers';

describe('seed data', () => {
  it('has unique ingredient ids', () => {
    expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length);
  });

  it('has unique recipe ids and plenty of recipes', () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    expect(RECIPES.length).toBeGreaterThanOrEqual(30);
  });

  it('displayUnit is always a unit alias', () => {
    for (const i of INGREDIENTS) if (i.displayUnit) expect(i.unitAliases?.[i.displayUnit], i.id).toBeGreaterThan(0);
  });

  for (const r of RECIPES) {
    it(`${r.id}: every ingredient exists and converts`, () => {
      expect(r.steps.length).toBeGreaterThan(0);
      expect(r.slots.length).toBeGreaterThan(0);
      for (const ri of r.ingredients) {
        const ing = ingById.get(ri.ingredientId);
        expect(ing, `${r.id} → ${ri.ingredientId}`).toBeDefined();
        const base = toBase(ri.qty, ri.unit, ing!);
        expect(base, `${r.id} ${ri.ingredientId}`).toBeGreaterThan(0);
      }
    });
  }
});
