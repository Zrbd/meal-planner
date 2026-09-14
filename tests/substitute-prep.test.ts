import { describe, expect, it } from 'vitest';
import { defineRecipe } from '../src/data/recipes/define';
import { addDaysISO } from '../src/domain/dates';
import { cutLife, isCut, weekPrep } from '../src/domain/prepweek';
import { displayStep, substitute, swapAmount, swapSuggestions } from '../src/domain/substitute';
import { INGREDIENTS } from '../src/data/ingredients';
import { ing, ingById, meal } from './helpers';

const credit = { name: 'Test fixture', url: 'https://example.com' };
const TODAY = '2026-09-15';

const soup = defineRecipe({
  id: 'test-soup', title: 'Veggie Soup', description: '', servings: 4, prep: 10, cook: 30, cuisine: 'American', credit,
  ingredients: [[4, 'cup', 'vegetable-broth'], [1, 'ea', 'yellow-onion', 'diced'], [2, 'clove', 'garlic', 'minced']],
  steps: ['Sauté the onion.', 'Pour in the vegetable broth and simmer. Taste the Vegetable broth for salt.'],
});

describe('substitutions', () => {
  it('keeps the amount when units match and rewrites the steps', () => {
    const ings = substitute(soup, 0, ing('chicken-broth'), ingById);
    expect(ings[0]).toMatchObject({ ingredientId: 'chicken-broth', qty: 4, unit: 'cup', swappedFrom: { ingredientId: 'vegetable-broth', qty: 4, unit: 'cup' } });
    const swapped = { ...soup, ingredients: ings };
    expect(displayStep(soup.steps[1], swapped, ingById)).toBe('Pour in the chicken broth and simmer. Taste the Chicken broth for salt.');
    expect(substitute(swapped, 0, ing('vegetable-broth'), ingById)[0]).toEqual(soup.ingredients[0]);
  });

  it('converts when the new ingredient does not use that unit', () => {
    const one = swapAmount({ qty: 1, unit: 'can' }, ing('chickpeas'), ing('black-beans'));
    expect(one).toEqual({ qty: 1, unit: 'can' });
    const noClove = { ...ing('shallot'), unitAliases: undefined, displayUnit: undefined };
    const amt = swapAmount({ qty: 2, unit: 'clove' }, ing('garlic'), noClove);
    expect(amt.unit).not.toBe('clove');
  });

  it('suggests similar ingredients first', () => {
    expect(swapSuggestions(ing('vegetable-broth'), INGREDIENTS)[0].id).toBe('chicken-broth');
  });
});

describe('prep checklist', () => {
  it('recognizes knife prep', () => {
    expect(isCut('diced')).toBe(true);
    expect(isCut('cut into 1-inch pieces')).toBe(true);
    expect(isCut('drained and rinsed')).toBe(false);
    expect(isCut('cooked and shredded')).toBe(false);
    expect(cutLife(ing('chicken-breast'))).toBe(2);
  });

  it('puts cuts in the fridge or freezer depending on when they are cooked', () => {
    const stirFry = defineRecipe({
      id: 'test-stirfry', title: 'Stir Fry', description: '', servings: 4, prep: 10, cook: 10, cuisine: 'Chinese', credit,
      ingredients: [[1, 'lb', 'chicken-breast', 'sliced thin'], [1, 'ea', 'yellow-onion', 'sliced']],
      steps: ['Cook.'],
    });
    const fajitas = { ...stirFry, id: 'test-fajitas', ingredients: [{ ingredientId: 'chicken-breast', qty: 1, unit: 'lb', prep: 'cut into strips' }] };
    const recipesById = new Map([[stirFry.id, stirFry], [fajitas.id, fajitas]]);
    const groups = weekPrep({
      meals: [meal(stirFry.id, addDaysISO(TODAY, 1)), meal(fajitas.id, addDaysISO(TODAY, 4))],
      recipesById, ingById, from: TODAY, to: addDaysISO(TODAY, 6),
    });
    expect(groups[0].ingredientId).toBe('chicken-breast');
    expect(groups[0].tasks.map((t) => t.storage)).toEqual(['fridge', 'freezer']);
    expect(groups[0].tasks[1].thawOn).toBe(addDaysISO(TODAY, 3));
    expect(groups[1].tasks[0].storage).toBe('fridge');
  });
});
