import { describe, expect, it } from 'vitest';
import { scaleChoices, scaleToAmount, servingsAtScale } from '../src/domain/scaleto';
import { ingById } from './helpers';
import { RECIPES } from '../src/data/recipes';
import type { Recipe, RecipeIngredient } from '../src/domain/types';

const recipe = RECIPES.find((r) => r.ingredients.some((ri) => ri.qty > 0))! as Recipe;

describe('scaleToAmount', () => {
  const ing = ingById.get('all-purpose-flour')!;
  const ri: RecipeIngredient = { ingredientId: ing.id, qty: 3, unit: 'cup' };

  it('gives the factor that lands on the amount you want to use', () => {
    expect(scaleToAmount(ri, ing, 1, 'cup')).toBeCloseTo(1 / 3);
    expect(scaleToAmount(ri, ing, 6, 'cup')).toBeCloseTo(2);
  });

  it('refuses amounts that make no sense', () => {
    expect(scaleToAmount(ri, ing, 0, 'cup')).toBeUndefined();
    expect(scaleToAmount({ ...ri, qty: 0 }, ing, 1, 'cup')).toBeUndefined();
  });
});

describe('scaleChoices', () => {
  it('offers whole amounts a cook would buy, with the servings they make', () => {
    const ing = ingById.get('all-purpose-flour')!;
    const choices = scaleChoices(recipe, { ingredientId: ing.id, qty: 2, unit: 'cup' }, ing);
    expect(choices.length).toBeGreaterThan(0);
    for (const c of choices) {
      expect(c.factor).toBeGreaterThan(0);
      expect(c.servings).toBeGreaterThanOrEqual(0.5);
      expect(c.label).toMatch(/\S/);
    }
  });
});

describe('servingsAtScale', () => {
  it('keeps servings to readable halves', () => {
    expect(servingsAtScale({ ...recipe, baseServings: 4 }, 1 / 3)).toBe(1.5);
    expect(servingsAtScale({ ...recipe, baseServings: 4 }, 0.01)).toBe(0.5);
  });
});
