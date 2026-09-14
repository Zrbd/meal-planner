import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { RECIPES } from '../src/data/recipes';
import { db } from '../src/db/schema';
import { seedIfNeeded } from '../src/db/seed';
import { cookRecipe, undoCook } from '../src/services/cook';
import { addStock, openPackage, saveUnits, useSome } from '../src/services/pantry';
import { substituteIngredient } from '../src/services/recipes';

const brothLots = async () =>
  (await db.lots.where('ingredientId').equals('chicken-broth').toArray()).map((l) => `${l.qty}|${l.opened ? 'open' : 'sealed'}|${l.location}`).sort();

beforeEach(async () => {
  await db.delete();
  await db.open();
  await seedIfNeeded();
  await saveUnits('chicken-broth', { unitAliases: { can: 414 }, packages: [{ label: 'can', qty: 414 }] });
});

describe('sealed and opened stock', () => {
  it('cooking from cans leaves the rest as an opened lot, and undo folds it back', async () => {
    await addStock('chicken-broth', 828, { location: 'pantry' });
    const logId = await cookRecipe({ recipeId: RECIPES[0].id, servings: 4, amounts: { 'chicken-broth': 240 } });
    expect(await brothLots()).toEqual(['174|open|fridge', '414|sealed|pantry']);
    await undoCook(logId);
    expect(await brothLots()).toEqual(['828|sealed|pantry']);
  });

  it('uses the opened can before the sealed ones', async () => {
    await addStock('chicken-broth', 828, { location: 'pantry' });
    await useSome('chicken-broth', 300);
    await useSome('chicken-broth', 100);
    expect(await brothLots()).toEqual(['14|open|fridge', '414|sealed|pantry']);
  });

  it('opens one package on request', async () => {
    await addStock('chicken-broth', 828, { location: 'pantry' });
    const [lot] = await db.lots.toArray();
    await openPackage(lot.id);
    expect(await brothLots()).toEqual(['414|open|fridge', '414|sealed|pantry']);
  });

  it('keeps the user’s units when the catalog updates', async () => {
    await db.kv.put({ key: 'seedVersion', value: 0 });
    await seedIfNeeded();
    const ing = await db.ingredients.get('chicken-broth');
    expect(ing?.unitAliases).toEqual({ can: 414 });
    expect(ing?.packages).toEqual([{ label: 'can', qty: 414 }]);
  });
});

describe('substitutions', () => {
  it('swaps an ingredient everywhere and can switch back', async () => {
    const recipe = RECIPES.find((r) => r.ingredients.some((i) => i.ingredientId === 'vegetable-broth'))!;
    const idx = recipe.ingredients.findIndex((i) => i.ingredientId === 'vegetable-broth');
    await substituteIngredient(recipe.id, idx, 'chicken-broth');
    let r = (await db.recipes.get(recipe.id))!;
    expect(r.ingredients[idx]).toMatchObject({ ingredientId: 'chicken-broth', qty: recipe.ingredients[idx].qty, swappedFrom: { ingredientId: 'vegetable-broth' } });
    expect(r.userEdited).toBe(true);
    await substituteIngredient(recipe.id, idx, 'vegetable-broth');
    r = (await db.recipes.get(recipe.id))!;
    expect(r.ingredients[idx].ingredientId).toBe('vegetable-broth');
    expect(r.ingredients[idx].swappedFrom).toBeUndefined();
  });
});
