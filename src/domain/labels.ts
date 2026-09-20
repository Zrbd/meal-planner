// Freezer and leftover labels. A container with no label is a science experiment in four
// months; this prints what it is, how many portions, when it went in and when to eat it by,
// in a shape that fits a strip of masking tape.
import { formatDay, toISODate } from './dates';
import type { FreezerMeal } from './leftovers';
import type { ISODate, Recipe, StockLot, Ingredient } from './types';

export interface Label {
  /** Big line: what it is. */
  title: string;
  /** Small second line: portions, servings, weight. */
  detail?: string;
  /** 'Frozen 12 Mar' */
  packed: string;
  /** 'Eat by 10 Jun' */
  useBy: string;
  /** How to bring it back, when we know. */
  reheat?: string;
}

const REHEAT: Record<string, string> = {
  soup: 'Thaw overnight, reheat gently on the stove.',
  stew: 'Thaw overnight, reheat gently on the stove.',
  sauce: 'Thaw overnight, warm over low heat, loosen with water.',
  bake: 'Bake from frozen, covered, 190°C until hot through.',
  default: 'Thaw overnight in the fridge, then reheat covered.',
};

function reheatFor(recipe: Recipe | undefined): string {
  if (!recipe) return REHEAT.default;
  const hay = `${recipe.title} ${recipe.tags?.join(' ') ?? ''}`.toLowerCase();
  if (hay.includes('soup') || hay.includes('broth') || hay.includes('chowder')) return REHEAT.soup;
  if (hay.includes('stew') || hay.includes('chili') || hay.includes('curry') || hay.includes('braise')) return REHEAT.stew;
  if (hay.includes('sauce') || hay.includes('ragu') || hay.includes('gravy')) return REHEAT.sauce;
  if (hay.includes('casserole') || hay.includes('bake') || hay.includes('lasagna') || hay.includes('gratin')) return REHEAT.bake;
  return REHEAT.default;
}

export function freezerLabel(meal: FreezerMeal, recipe: Recipe | undefined, pattern = 'd MMM'): Label {
  const frozenOn = meal.frozenAt ? toISODate(new Date(meal.frozenAt)) : undefined;
  return {
    title: recipe?.title ?? 'Leftovers',
    detail: `${meal.portions} portion${meal.portions === 1 ? '' : 's'}${meal.servingsEach ? ` · ${meal.servingsEach} serving each` : ''}`,
    packed: frozenOn ? `Frozen ${formatDay(frozenOn, pattern)}` : 'Frozen',
    useBy: meal.eatBy ? `Eat by ${formatDay(meal.eatBy, pattern)}` : 'No date',
    reheat: reheatFor(recipe),
  };
}

export function lotLabel(lot: StockLot, ing: Ingredient | undefined, today: ISODate, pattern = 'd MMM'): Label {
  return {
    title: ing?.name ?? 'Item',
    detail: lot.opened ? 'Opened package' : undefined,
    packed: `In ${formatDay(today, pattern)}`,
    useBy: lot.expiresOn ? `Use by ${formatDay(lot.expiresOn, pattern)}` : 'No date',
  };
}

/** Plain text, for the share sheet or a label printer that takes text. */
export function labelText(label: Label): string {
  return [label.title, label.detail, label.packed, label.useBy, label.reheat].filter(Boolean).join('\n');
}

/**
 * Labels laid out for printing: a grid of cards on one page. Returns the rows, so the
 * component only has to draw boxes.
 */
export function labelSheet(labels: Label[], perPage = 8): Label[][] {
  const pages: Label[][] = [];
  for (let i = 0; i < labels.length; i += perPage) pages.push(labels.slice(i, i + perPage));
  return pages.length ? pages : [[]];
}
