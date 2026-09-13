import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { INGREDIENTS } from '../src/data/ingredients';
import { RECIPES } from '../src/data/recipes';
import { exportBackup, importBackup, resetEverything } from '../src/db/backup';
import { db } from '../src/db/schema';
import { seedIfNeeded } from '../src/db/seed';
import { getSettings, updateSettings } from '../src/db/settings';
import { recipeNeeds } from '../src/domain/stock';
import { cookRecipe, undoCook } from '../src/services/cook';
import { addStock, ranOut, setAmount, setLooseLevel, useSome } from '../src/services/pantry';
import { addMeal } from '../src/services/plan';
import { deleteRecipe, duplicateRecipe, saveRecipe } from '../src/services/recipes';
import { addManualItem, toggleChecked } from '../src/services/shopping';
import { finishTrip, undoTrip } from '../src/services/trip';

const exactIng = INGREDIENTS.find((i) => i.trackMode === 'exact' && i.shelfLife.fridge && i.baseUnit === 'g')!;
const looseIng = INGREDIENTS.find((i) => i.trackMode === 'loose')!;
const total = async (id: string) =>
  (await db.lots.where('ingredientId').equals(id).toArray()).reduce((s, l) => s + l.qty, 0);

beforeEach(async () => {
  await db.delete();
  await db.open();
  await seedIfNeeded();
});

describe('seed', () => {
  it('loads catalog and recipes once', async () => {
    expect(await db.recipes.count()).toBe(RECIPES.length);
    expect(await db.ingredients.count()).toBe(INGREDIENTS.length);
    expect(await seedIfNeeded()).toBe(false);
  });

  it('keeps user-edited built-in recipes and favorites on reseed', async () => {
    const id = RECIPES[0].id;
    await db.recipes.update(id, { title: 'My version', userEdited: true });
    await db.recipes.update(RECIPES[1].id, { favorite: true });
    await db.kv.put({ key: 'seedVersion', value: 0 });
    expect(await seedIfNeeded()).toBe(true);
    expect((await db.recipes.get(id))!.title).toBe('My version');
    expect((await db.recipes.get(RECIPES[1].id))!.favorite).toBe(true);
  });

  it('settings default and merge', async () => {
    expect((await getSettings()).householdSize).toBe(2);
    await updateSettings({ householdSize: 4 });
    const s = await getSettings();
    expect(s.householdSize).toBe(4);
    expect(s.mealsPerWeek.dinner).toBe(5);
  });
});

describe('pantry', () => {
  it('adds stock with default expiry and removes FIFO by expiry', async () => {
    await addStock(exactIng.id, 500, { location: 'fridge', expiresOn: '2030-01-10' });
    await addStock(exactIng.id, 300, { location: 'fridge', expiresOn: '2030-01-02' });
    const missing = await useSome(exactIng.id, 400);
    expect(missing).toBe(0);
    const lots = await db.lots.where('ingredientId').equals(exactIng.id).toArray();
    expect(lots).toHaveLength(1);
    expect(lots[0].expiresOn).toBe('2030-01-10');
    expect(lots[0].qty).toBe(400);

    const auto = await addStock(exactIng.id, 100);
    expect((await db.lots.get(auto))!.expiresOn).toBeTruthy();
  });

  it('setAmount and ranOut record adjustments', async () => {
    await addStock(exactIng.id, 500);
    await setAmount(exactIng.id, 200);
    expect(await total(exactIng.id)).toBeCloseTo(200);
    await setAmount(exactIng.id, 350);
    expect(await total(exactIng.id)).toBeCloseTo(350);
    await ranOut(exactIng.id);
    expect(await total(exactIng.id)).toBe(0);
    const reasons = (await db.txns.toArray()).map((t) => t.reason);
    expect(reasons.filter((r) => r === 'adjust').length).toBeGreaterThanOrEqual(3);
  });
});

describe('cooking', () => {
  it('deducts needs and undo restores stock and meal status', async () => {
    const recipe = RECIPES.find((r) => r.id === 'spaghetti-bolognese')!;
    const ingById = new Map(INGREDIENTS.map((i) => [i.id, i]));
    const { needs } = recipeNeeds(recipe, 4, ingById);
    const exactNeeds = [...needs].filter(([id]) => ingById.get(id)!.trackMode === 'exact');
    for (const [id, qty] of exactNeeds) await addStock(id, qty * 2);
    const before = new Map<string, number>();
    for (const [id] of exactNeeds) before.set(id, await total(id));

    const mealId = await addMeal(recipe.id, '2030-01-01', 'dinner', 4);
    const logId = await cookRecipe({ recipeId: recipe.id, servings: 4, plannedMealId: mealId });
    for (const [id, qty] of exactNeeds) expect(await total(id)).toBeCloseTo(before.get(id)! - qty, 1);
    expect((await db.meals.get(mealId))!.status).toBe('cooked');
    expect(await db.cookLogs.count()).toBe(1);

    await undoCook(logId);
    for (const [id] of exactNeeds) expect(await total(id)).toBeCloseTo(before.get(id)!, 3);
    expect((await db.meals.get(mealId))!.status).toBe('planned');
    expect(await db.cookLogs.count()).toBe(0);
  });
});

describe('shopping trip', () => {
  it('finishing creates stock, restocks loose items, clears state; undo removes stock', async () => {
    await setLooseLevel(looseIng.id, 'out');
    await toggleChecked(exactIng.id);
    await addManualItem('Paper towels');
    const manual = (await db.shopping.toArray()).find((s) => s.manualName)!;
    const tripId = await finishTrip(['2030-01-01', '2030-01-07'], [
      { key: exactIng.id, ingredientId: exactIng.id, name: exactIng.name, qty: 454 },
      { key: looseIng.id, ingredientId: looseIng.id, name: looseIng.name, qty: 50 },
      { key: manual.key, name: 'Paper towels', qty: 0 },
    ]);
    expect(await total(exactIng.id)).toBe(454);
    expect((await db.loose.get(looseIng.id))!.level).toBe('plenty');
    expect(await db.shopping.count()).toBe(0);
    await undoTrip(tripId);
    expect(await total(exactIng.id)).toBe(0);
    expect(await db.trips.count()).toBe(0);
  });
});

describe('recipes', () => {
  it('saves user recipes, duplicates, and archives built-ins on delete', async () => {
    const id = await saveRecipe({
      title: "Grandma's Chili", description: '', baseServings: 4, prepMin: 10, cookMin: 40, difficulty: 1,
      cuisine: 'American', diet: [], slots: ['dinner'], steps: ['Cook it.'],
      ingredients: [{ ingredientId: exactIng.id, qty: 1, unit: 'lb' }],
    });
    expect(id).toBe('grandmas-chili');
    const r = (await db.recipes.get(id))!;
    expect(r.source).toBe('user');
    const copy = await duplicateRecipe(id);
    expect(copy).not.toBe(id);
    await deleteRecipe(id);
    expect(await db.recipes.get(id)).toBeUndefined();

    await deleteRecipe(RECIPES[0].id);
    expect((await db.recipes.get(RECIPES[0].id))!.archived).toBe(true);

    await saveRecipe({ ...RECIPES[2], title: 'Edited' });
    expect((await db.recipes.get(RECIPES[2].id))!.userEdited).toBe(true);
  });
});

describe('backup', () => {
  it('round-trips all data and rejects junk', async () => {
    await addStock(exactIng.id, 123);
    await addMeal(RECIPES[0].id, '2030-01-01', 'dinner', 2);
    const backup = await exportBackup();
    await resetEverything();
    expect(await db.lots.count()).toBe(0);
    await importBackup(JSON.stringify(backup));
    expect(await total(exactIng.id)).toBe(123);
    expect(await db.meals.count()).toBe(1);
    await expect(importBackup('{"nope":1}')).rejects.toThrow();
    await expect(importBackup('not json')).rejects.toThrow();
  });
});
