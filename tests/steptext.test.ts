import { describe, expect, it } from 'vitest';
import { convertTemps, renderStep, scaleStepText } from '../src/domain/steptext';

const words = new Set(['onion', 'egg', 'tortilla']);
const scale = (t: string, s: number) => scaleStepText(t, s, 'us', words);

describe('scaleStepText', () => {
  it('rewrites counted containers for the chosen serving size', () => {
    expect(scale('Drain 3 (15 oz) cans of pinto beans and add them to the pot.', 1 / 3))
      .toBe('Drain 1 (15 oz) can of pinto beans and add them to the pot.');
    expect(scale('Add two cans of tomatoes.', 0.5)).toBe('Add 1 can of tomatoes.');
  });

  it('scales measures and keeps the way they were written', () => {
    expect(scale('Heat 2 tablespoons olive oil.', 0.5)).toBe('Heat 1 tablespoon olive oil.');
    expect(scale('Stir in 1 cup rice.', 1.5)).toBe('Stir in 1½ cups rice.');
    expect(scale('Add 1/2 tsp salt.', 2)).toBe('Add 1 tsp salt.');
  });

  it('scales things the recipe counts', () => {
    expect(scale('Dice 1 onion.', 2)).toBe('Dice 2 onions.');
    expect(scale('Beat 4 eggs.', 0.5)).toBe('Beat 2 eggs.');
  });

  it('leaves times, sizes and equipment alone', () => {
    const t = 'Bake 45 minutes in a 2-quart baking dish, then rest 10 minutes.';
    expect(scale(t, 0.5)).toBe(t);
    expect(scale('Cut into 1-inch pieces.', 2)).toBe('Cut into 1-inch pieces.');
  });

  it('converts measures for a metric cook', () => {
    expect(scaleStepText('Add 1 cup milk and 8 oz cheese.', 1, 'metric', words))
      .toBe('Add 240 ml milk and 230 g cheese.');
    expect(scaleStepText('Add 500 g chicken.', 1, 'us', words)).toBe('Add 1⅛ lb chicken.');
  });
});

describe('convertTemps', () => {
  it('shows the temperature the reader uses and drops the duplicate', () => {
    expect(convertTemps('Heat the oven to 350°F.', 'metric')).toBe('Heat the oven to 175°C.');
    expect(convertTemps('Heat the oven to 335°F (170°C).', 'metric')).toBe('Heat the oven to 170°C.');
    expect(convertTemps('Heat the oven to 335°F (170°C).', 'us')).toBe('Heat the oven to 335°F.');
    expect(convertTemps('Heat the oven to 180 degrees C.', 'us')).toBe('Heat the oven to 355°F.');
  });

  it('does not touch plain numbers', () => {
    expect(convertTemps('Simmer 20 minutes.', 'metric')).toBe('Simmer 20 minutes.');
  });
});

describe('renderStep', () => {
  it('scales and converts together', () => {
    expect(renderStep('Heat the oven to 350°F and add 2 cups water.', { scale: 0.5, system: 'metric' }))
      .toBe('Heat the oven to 175°C and add 240 ml water.');
  });
});
