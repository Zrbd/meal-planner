import { describe, expect, it } from 'vitest';
import { afterUse, describeStock, inferPackSize, openedLife, packName } from '../src/domain/containers';
import { addDaysISO } from '../src/domain/dates';
import type { Ingredient } from '../src/domain/types';
import { ing, lot } from './helpers';

const TODAY = '2026-09-15';
// A user-defined can size for broth, the way the "Units & sizes" editor saves it.
const broth: Ingredient = { ...ing('chicken-broth'), unitAliases: { can: 414 }, packages: [{ label: 'can', qty: 414 }], unitsEdited: true };
const garlic = ing('garlic');

describe('containers', () => {
  it('infers the package size from the amount bought', () => {
    expect(inferPackSize(828, broth)).toBe(414);
    expect(inferPackSize(500, broth)).toBeUndefined();
    expect(inferPackSize(100, garlic)).toBe(50);
  });

  it('keeps whole cans sealed and moves the opened rest to the fridge', () => {
    const cans = lot('chicken-broth', 828, { location: 'pantry', packSize: 414, expiresOn: '2027-09-01' });
    const r = afterUse(cans, 240, broth, TODAY);
    expect(r.left).toBe(414);
    expect(r.opened).toEqual({ qty: 174, location: 'fridge', expiresOn: addDaysISO(TODAY, 4) });
    expect(openedLife(broth)).toEqual({ fridge: 4, freezer: 60 });
  });

  it('uses up a whole package without leaving an opened lot', () => {
    const cans = lot('chicken-broth', 828, { location: 'pantry', packSize: 414 });
    expect(afterUse(cans, 414, broth, TODAY)).toEqual({ left: 414 });
    expect(afterUse(cans, 828, broth, TODAY)).toEqual({ left: 0 });
  });

  it('opened lots just shrink', () => {
    const open = lot('chicken-broth', 174, { location: 'fridge', opened: true });
    expect(afterUse(open, 74, broth, TODAY)).toEqual({ left: 100 });
  });

  it('respects a custom opened shelf life and keeps garlic where it is', () => {
    const head = lot('garlic', 50, { location: 'pantry', packSize: 50, expiresOn: '2026-11-01' });
    const r = afterUse(head, 15, garlic, TODAY);
    expect(r).toEqual({ left: 0, opened: { qty: 35, location: 'pantry', expiresOn: '2026-11-01' } });
    const custom = { ...garlic, openedShelfLife: { pantry: 10 } };
    expect(afterUse(head, 15, custom, TODAY).opened?.expiresOn).toBe(addDaysISO(TODAY, 10));
  });

  it('describes sealed and opened stock', () => {
    const lots = [
      lot('chicken-broth', 828, { packSize: 414 }),
      lot('chicken-broth', 174, { opened: true }),
    ];
    expect(describeStock(lots, broth)).toBe('2 cans + ¾ cup open');
    expect(describeStock([lot('garlic', 50, { packSize: 50 }), lot('garlic', 35, { opened: true })], garlic)).toBe('1 head + 7 cloves open');
    expect(describeStock([lot('chicken-broth', 300)], broth)).toBe('1¼ cups');
    expect(packName(broth, 414, 3)).toBe('cans');
  });
});
