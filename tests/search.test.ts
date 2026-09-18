import { describe, expect, it } from 'vitest';
import { RECIPES } from '../src/data/recipes';
import { rankRecipes, searchRecipes, tokenize } from '../src/domain/search';
import { ingById } from './helpers';

const find = (q: string) => searchRecipes(RECIPES, q, { ingById });

describe('searchRecipes', () => {
  it('puts the recipes that are actually about the phrase first', () => {
    const honey = find('honey chicken');
    expect(honey.length).toBeGreaterThan(0);
    // Every word has to match, so plain chicken recipes with no honey are out.
    for (const r of honey.slice(0, 5)) {
      const text = `${r.title} ${r.ingredients.map((i) => i.ingredientId).join(' ')}`.toLowerCase();
      expect(text, r.title).toMatch(/honey/);
      expect(text, r.title).toMatch(/chicken/);
    }
  });

  it('still finds a single word across titles and ingredients', () => {
    expect(find('honey').length).toBeGreaterThan(0);
  });

  it('matches ingredients the title does not mention', () => {
    const hits = find('chickpeas');
    expect(hits.some((r) => r.ingredients.some((i) => i.ingredientId.includes('chickpea')))).toBe(true);
  });

  it('drops recipes that miss one of the words', () => {
    const hits = rankRecipes(RECIPES, 'honey chicken', { ingById });
    expect(hits.every((h) => h.complete)).toBe(true);
  });

  it('falls back to near-misses rather than showing nothing', () => {
    expect(find('chicken zzzzqq').length).toBeGreaterThan(0);
  });

  it('ignores filler words', () => {
    expect(tokenize('a recipe with the chicken and rice')).toEqual(['chicken', 'rice']);
  });
});
