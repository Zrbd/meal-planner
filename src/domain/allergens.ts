// Allergen guard: which of the nine common allergens (plus a few intolerances) an ingredient
// carries, and therefore which recipes are off the table for this household.
//
// This is a helpful warning, not a safety guarantee. Brands hide milk in stock powder and
// wheat in soy sauce, and the app can only reason about the ingredient you told it about —
// so the UI always says "check the label" next to anything it flags.
import type { Ingredient, Recipe } from './types';

export type AllergenId =
  | 'milk'
  | 'egg'
  | 'peanut'
  | 'tree-nut'
  | 'wheat'
  | 'soy'
  | 'fish'
  | 'shellfish'
  | 'sesame'
  | 'pork'
  | 'alcohol';

export interface Allergen {
  id: AllergenId;
  label: string;
  emoji: string;
  /** Ingredient ids that carry it outright. */
  ids: string[];
  /** Substrings matched against the ingredient id and name, for anything not listed. */
  match: string[];
}

export const ALLERGENS: Allergen[] = [
  {
    id: 'milk', label: 'Milk', emoji: '🥛',
    ids: ['butter', 'ghee', 'milk', 'buttermilk', 'heavy-cream', 'half-and-half', 'sour-cream', 'creme-fraiche',
      'greek-yogurt', 'cream-cheese', 'mascarpone', 'cottage-cheese', 'ricotta', 'evaporated-milk',
      'sweetened-condensed-milk', 'milk-powder', 'dulce-de-leche', 'paneer', 'instant-pudding', 'ranch-dressing'],
    match: ['cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'gruyere', 'provolone', 'cotija', 'gouda', 'curds'],
  },
  {
    id: 'egg', label: 'Egg', emoji: '🥚',
    ids: ['eggs', 'mayonnaise', 'ranch-dressing', 'egg-noodles', 'ladyfingers', 'meringue-cookies', 'vanilla-wafers'],
    match: ['meringue'],
  },
  {
    id: 'peanut', label: 'Peanut', emoji: '🥜',
    ids: ['peanuts', 'peanut-butter'],
    match: ['peanut'],
  },
  {
    id: 'tree-nut', label: 'Tree nut', emoji: '🌰',
    ids: ['almonds', 'cashews', 'pecans', 'walnuts', 'pistachios', 'pine-nuts', 'shredded-coconut'],
    match: ['almond', 'cashew', 'pecan', 'walnut', 'pistachio', 'hazelnut'],
  },
  {
    id: 'wheat', label: 'Wheat / gluten', emoji: '🌾',
    ids: ['all-purpose-flour', 'whole-wheat-flour', 'semolina', 'bulgur', 'couscous', 'panko', 'soy-sauce',
      'dark-soy-sauce', 'hoisin', 'oyster-sauce', 'seitan', 'phyllo-dough', 'puff-pastry', 'pie-crust', 'kataifi',
      'wonton-wrappers', 'spring-roll-wrappers', 'gnocchi', 'crackers', 'graham-crackers', 'ladyfingers',
      'vanilla-wafers', 'doenjang', 'doubanjiang', 'curry-roux'],
    match: ['flour', 'bread', 'bun', 'bagel', 'pita', 'baguette', 'pasta', 'spaghetti', 'penne', 'linguine',
      'fettuccine', 'macaroni', 'orzo', 'noodle', 'tortellini', 'tortilla'],
  },
  {
    id: 'soy', label: 'Soy', emoji: '🫘',
    ids: ['soy-sauce', 'dark-soy-sauce', 'tofu', 'silken-tofu', 'miso', 'doenjang', 'doubanjiang', 'gochujang',
      'black-bean-paste', 'hoisin', 'kecap-manis', 'edamame'],
    match: ['soy', 'tofu', 'miso'],
  },
  {
    id: 'fish', label: 'Fish', emoji: '🐟',
    ids: ['fish-sauce', 'worcestershire', 'salmon', 'cod', 'tuna', 'anchovies'],
    match: ['fish', 'anchov'],
  },
  {
    id: 'shellfish', label: 'Shellfish', emoji: '🦐',
    ids: ['shrimp', 'dried-shrimp', 'shrimp-paste', 'clams', 'crab-meat', 'oyster-sauce'],
    match: ['shrimp', 'crab', 'clam', 'oyster', 'lobster', 'scallop', 'prawn'],
  },
  {
    id: 'sesame', label: 'Sesame', emoji: '🫓',
    ids: ['sesame-seeds', 'sesame-oil', 'tahini', 'zaatar', 'everything-seasoning'],
    match: ['sesame', 'tahini'],
  },
  {
    id: 'pork', label: 'Pork', emoji: '🐖',
    ids: ['bacon', 'ham', 'deli-ham', 'serrano-ham', 'spam', 'chicharrones', 'chorizo', 'lard', 'gelatin'],
    match: ['pork', 'bacon', 'ham', 'pancetta', 'prosciutto', 'sausage'],
  },
  {
    id: 'alcohol', label: 'Alcohol', emoji: '🍷',
    ids: ['beer', 'dry-white-wine', 'dry-red-wine', 'marsala-wine', 'shaoxing-wine', 'sake', 'mirin', 'brandy',
      'vanilla-extract'],
    match: ['wine', 'rum', 'whiskey', 'bourbon', 'vodka', 'liqueur'],
  },
];

export const allergenById = (id: AllergenId): Allergen | undefined => ALLERGENS.find((a) => a.id === id);

const cache = new WeakMap<Ingredient, Set<AllergenId>>();

/** Which allergens an ingredient carries. Cached, because recipe lists call this a lot. */
export function allergensOf(ing: Ingredient): Set<AllergenId> {
  const hit = cache.get(ing);
  if (hit) return hit;
  const found = new Set<AllergenId>();
  const haystack = `${ing.id} ${ing.name.toLowerCase()}`;
  for (const a of ALLERGENS) {
    if (a.ids.includes(ing.id) || a.match.some((m) => haystack.includes(m))) found.add(a.id);
  }
  // Some ingredients are named for a food they do not contain: "italian seasoning" is not sausage.
  if (ing.aisle === 'spices') {
    found.delete('pork');
    found.delete('wheat');
  }
  cache.set(ing, found);
  return found;
}

export interface AllergenHit {
  allergen: AllergenId;
  /** The ingredients in this recipe that triggered it. */
  ingredientIds: string[];
  /** Every trigger is an optional ingredient, so leaving them out clears the warning. */
  avoidable: boolean;
}

/** Which of the household's avoided allergens this recipe actually contains, and where. */
export function recipeAllergens(
  recipe: Recipe,
  ingById: Map<string, Ingredient>,
  avoiding: AllergenId[],
): AllergenHit[] {
  if (!avoiding.length) return [];
  const want = new Set(avoiding);
  const byAllergen = new Map<AllergenId, { ids: string[]; required: boolean }>();
  for (const ri of recipe.ingredients) {
    const ing = ingById.get(ri.ingredientId);
    if (!ing) continue;
    for (const id of allergensOf(ing)) {
      if (!want.has(id)) continue;
      const row = byAllergen.get(id) ?? { ids: [], required: false };
      row.ids.push(ri.ingredientId);
      if (!ri.optional) row.required = true;
      byAllergen.set(id, row);
    }
  }
  return [...byAllergen.entries()]
    .map(([allergen, row]) => ({ allergen, ingredientIds: row.ids, avoidable: !row.required }))
    .sort((a, b) => a.allergen.localeCompare(b.allergen));
}

/** True when the recipe is safe to put in front of this household without a warning. */
export const recipeIsSafe = (
  recipe: Recipe,
  ingById: Map<string, Ingredient>,
  avoiding: AllergenId[],
): boolean => recipeAllergens(recipe, ingById, avoiding).every((h) => h.avoidable);

export function describeHits(hits: AllergenHit[]): string {
  if (!hits.length) return '';
  const names = hits.map((h) => allergenById(h.allergen)?.label ?? h.allergen);
  return names.length === 1 ? `Contains ${names[0].toLowerCase()}` : `Contains ${names.join(', ').toLowerCase()}`;
}
