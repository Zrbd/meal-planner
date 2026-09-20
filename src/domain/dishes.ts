// What kind of dish a recipe is, what protein it's built on, and which pots and pans it dirties.
import { recipeNeeds } from './stock';
import type { Ingredient, Recipe } from './types';

export type DishType = 'main' | 'soup' | 'salad' | 'side' | 'breakfast' | 'dessert' | 'sauce' | 'snack';
export const DISH_TYPES: { id: DishType; label: string }[] = [
  { id: 'main', label: 'Entrée' },
  { id: 'soup', label: 'Soup & stew' },
  { id: 'salad', label: 'Salad' },
  { id: 'side', label: 'Side' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'sauce', label: 'Sauce & dip' },
  { id: 'snack', label: 'Snack' },
];

export type ProteinType = 'chicken' | 'turkey' | 'pork' | 'fish' | 'shrimp' | 'beans' | 'tofu' | 'eggs' | 'meatless';
export const PROTEIN_TYPES: { id: ProteinType; label: string }[] = [
  { id: 'chicken', label: 'Chicken' },
  { id: 'turkey', label: 'Turkey' },
  { id: 'pork', label: 'Pork' },
  { id: 'fish', label: 'Fish' },
  { id: 'shrimp', label: 'Shrimp' },
  { id: 'beans', label: 'Beans & lentils' },
  { id: 'tofu', label: 'Tofu' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'meatless', label: 'No main protein' },
];

const BY_ID: Record<string, ProteinType> = {
  'ground-turkey': 'turkey', 'deli-turkey': 'turkey',
  'pork-chops': 'pork', 'pork-tenderloin': 'pork', 'ground-pork': 'pork', bacon: 'pork', 'smoked-sausage': 'pork', 'italian-sausage': 'pork',
  cod: 'fish', salmon: 'fish', tuna: 'fish',
  shrimp: 'shrimp',
  'black-beans': 'beans', chickpeas: 'beans', 'kidney-beans': 'beans', 'pinto-beans': 'beans', 'cannellini-beans': 'beans',
  'refried-beans': 'beans', 'brown-lentils': 'beans', 'red-lentils': 'beans',
  tofu: 'tofu',
  eggs: 'eggs',
};

export function proteinOfIngredient(ing: Ingredient): ProteinType | null {
  if (BY_ID[ing.id]) return BY_ID[ing.id];
  if (ing.id.includes('chicken') && ing.aisle === 'meat') return 'chicken';
  if (ing.aisle === 'meat') return 'pork';
  if (ing.aisle === 'seafood') return 'fish';
  return null;
}

/** Dry lentils swell ~2.5× and cooked chicken has no bones or water to lose, so weigh them as their raw-meat equivalent. */
const PROTEIN_DENSITY: Record<string, number> = { 'brown-lentils': 2.5, 'red-lentils': 2.5, 'rotisserie-chicken': 1.3, 'deli-turkey': 1.2 };

/** Grams of each protein per serving (eggs count as 50 g each). */
function proteinGrams(recipe: Recipe, ingById: Map<string, Ingredient>): Map<ProteinType, number> {
  const out = new Map<ProteinType, number>();
  const { needs } = recipeNeeds(recipe, 1, ingById);
  for (const [id, qty] of needs) {
    const ing = ingById.get(id);
    if (!ing) continue;
    const p = proteinOfIngredient(ing);
    if (!p) continue;
    const g = ing.baseUnit === 'ea' ? qty * (ing.gramsPerEach ?? 50) : ing.baseUnit === 'ml' ? qty * (ing.density ?? 1) : qty;
    out.set(p, (out.get(p) ?? 0) + g * (PROTEIN_DENSITY[id] ?? 1));
  }
  return out;
}

/** A serving has enough meat, fish, beans, tofu or egg to count as a meal (~1 oz of meat, or a large egg). */
export const SUBSTANTIAL_PROTEIN_G = 28;

export function hasProtein(recipe: Recipe, ingById: Map<string, Ingredient>): boolean {
  let total = 0;
  for (const g of proteinGrams(recipe, ingById).values()) total += g;
  return total >= SUBSTANTIAL_PROTEIN_G;
}

export function proteinTypeOf(recipe: Recipe, ingById: Map<string, Ingredient>): ProteinType {
  let best: ProteinType = 'meatless';
  let bestG = 15; // a sprinkle of bacon doesn't make it a pork dish
  for (const [p, g] of proteinGrams(recipe, ingById)) if (g > bestG) [best, bestG] = [p, g];
  return best;
}

const has = (title: string, re: RegExp) => re.test(title.toLowerCase());

export function dishTypeOf(recipe: Recipe, ingById: Map<string, Ingredient>): DishType {
  const t = recipe.title;
  const onlyBreakfast = recipe.slots.length > 0 && recipe.slots.every((s) => s === 'breakfast');
  if (has(t, /\b(cookies?|brownies?|cake|cupcakes?|pudding|mousse|crumble|cobbler|crisp|pie|bars|fudge|ice cream|sorbet|truffles|bark)\b/) && !has(t, /pot pie|shepherd|cottage/)) return 'dessert';
  if (has(t, /\b(sauce|dressing|vinaigrette|salsa|dip|hummus|guacamole|gravy|pesto|aioli|chutney|relish|glaze|marinade|seasoning|spice (mix|blend)|pickled)\b/) && !has(t, /\b(with|in|chicken|pork|shrimp|salmon|pasta|noodles|tofu|meatballs)\b/)) return 'sauce';
  if (onlyBreakfast) return 'breakfast';
  const protein = hasProtein(recipe, ingById);
  if (has(t, /\b(soup|stew|chowder|chili|bisque|gumbo|pozole|posole|ramen|pho|minestrone|dal|dahl|broth)\b/)) return 'soup';
  if (has(t, /\bsalad\b/) && !has(t, /\b(sandwich|wrap|pita|lettuce wraps)\b/)) return protein ? 'salad' : 'side';
  if (protein) return 'main';
  if (has(t, /\b(energy (balls|bites)|trail mix|popcorn|granola bars?|roasted (nuts|chickpeas))\b/)) return 'snack';
  // Hearty meatless mains: pasta, pizza, grain bowls, stuffed things.
  if (has(t, /\b(pasta|spaghetti|penne|rigatoni|linguine|fettuccine|lasagna|mac(aroni)?|pizza|risotto|gnocchi|tortellini|ravioli|quesadillas?|enchiladas?|burritos?|tacos|bowls?|stir[- ]fry|curry|casserole|stuffed|frittata|sandwich(es)?|wraps?|grilled cheese|noodles|lo mein|pad thai|fried rice|flatbread|calzone|strata|bake)\b/)) return 'main';
  return 'side';
}

/** Is this something you'd serve as dinner on its own — a main (or hearty soup/salad) with real protein? */
export function isFullMeal(recipe: Recipe, ingById: Map<string, Ingredient>): boolean {
  const type = dishTypeOf(recipe, ingById);
  return (type === 'main' || type === 'soup' || type === 'salad') && hasProtein(recipe, ingById);
}

export interface Equipment {
  id: string;
  label: string;
  emoji: string;
}

const EQUIPMENT: (Equipment & { re: RegExp })[] = [
  { id: 'large-pot', label: 'Large pot', emoji: '🍲', re: /\b(stock ?pot|dutch oven|(?<!(instant|crock|small|medium) )pot(?! pie))\b/ },
  { id: 'saucepan', label: 'Saucepan', emoji: '🥘', re: /\b(sauce ?pan|small pot|medium pot)\b/ },
  { id: 'skillet', label: 'Skillet', emoji: '🍳', re: /\b(skillet|frying pan|fry pan|griddle|(?<!(sheet|loaf|muffin|grill|roasting|baking|cake|springform|sauce|pie|tart|bundt) )pan(?!-?(fried|seared)))\b/ },
  { id: 'wok', label: 'Wok', emoji: '🥢', re: /\bwok\b/ },
  { id: 'sheet-pan', label: 'Sheet pan', emoji: '🍪', re: /\b(sheet pan|baking sheet|tray|roasting pan|roasting tin|cookie sheet|rimmed sheet)\b/ },
  { id: 'baking-dish', label: 'Baking dish', emoji: '🫕', re: /\b(baking dish|casserole|\d+\s*[x×]\s*\d+|pie dish|loaf pan|gratin|oven-?(safe|proof) dish|baking pan)\b/ },
  { id: 'rice-cooker', label: 'Rice cooker', emoji: '🍚', re: /\brice cooker\b/ },
  { id: 'slow-cooker', label: 'Slow cooker', emoji: '⏲️', re: /\b(slow cooker|crock ?pot)\b/ },
  { id: 'pressure-cooker', label: 'Instant Pot', emoji: '♨️', re: /\b(instant pot|pressure cooker)\b/ },
  { id: 'air-fryer', label: 'Air fryer', emoji: '💨', re: /\bair fryer\b/ },
  { id: 'grill', label: 'Grill', emoji: '🔥', re: /\b(grill|grill pan|grate|grates)\b/ },
  { id: 'blender', label: 'Blender', emoji: '🌀', re: /\b(blender|food processor|immersion|stick blender)\b/ },
  { id: 'muffin-tin', label: 'Muffin tin', emoji: '🧁', re: /\bmuffin (tin|pan)\b/ },
  { id: 'mixing-bowl', label: 'Mixing bowl', emoji: '🥣', re: /\b(large bowl|mixing bowl)\b/ },
];

/** Look up a piece of gear by id, for the "what you own" list in settings. */
export const equipmentById = (id: string): Equipment | undefined => EQUIPMENT.find((e) => e.id === id);

export function equipmentOf(recipe: Recipe): Equipment[] {
  const text = recipe.steps.join(' ').toLowerCase();
  const found = EQUIPMENT.filter((e) => e.re.test(text));
  // Stovetop cooking with no vessel named ("scramble the eggs in oil over medium") still needs a pan.
  const stovetop = /\bover (low|medium|high|medium-low|medium-high)\b|\bstir-fry\b|\bsimmer\b/.test(text);
  if (stovetop && !found.some((e) => ['large-pot', 'saucepan', 'skillet', 'wok', 'slow-cooker', 'pressure-cooker'].includes(e.id))) {
    found.push(EQUIPMENT.find((e) => e.id === (/\bsimmer\b/.test(text) ? 'large-pot' : 'skillet'))!);
  }
  return found.map(({ id, label, emoji }) => ({ id, label, emoji }));
}

/** Everything a day's meals need, with how many dishes use each. */
export function equipmentForRecipes(recipes: Recipe[]): (Equipment & { count: number })[] {
  const map = new Map<string, Equipment & { count: number }>();
  for (const r of recipes) for (const e of equipmentOf(r)) {
    const cur = map.get(e.id);
    if (cur) cur.count++;
    else map.set(e.id, { ...e, count: 1 });
  }
  const order = EQUIPMENT.map((e) => e.id);
  return [...map.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

export type Starch = 'rice' | 'potato' | 'pasta' | 'bread' | 'beans';

const STARCH_BY_ID: Record<string, Starch> = {
  'white-rice': 'rice', 'brown-rice': 'rice', 'arborio-rice': 'rice',
  potato: 'potato', 'sweet-potato': 'potato', gnocchi: 'potato',
  spaghetti: 'pasta', penne: 'pasta', linguine: 'pasta', fettuccine: 'pasta', 'small-pasta': 'pasta',
  orzo: 'pasta', 'egg-noodles': 'pasta', 'lo-mein-noodles': 'pasta', 'rice-noodles': 'pasta',
  'refrigerated-tortellini': 'pasta', couscous: 'pasta', quinoa: 'pasta',
  baguette: 'bread', 'sandwich-bread': 'bread', pita: 'bread', 'flour-tortillas': 'bread',
  'corn-tortillas': 'bread', cornmeal: 'bread', 'hamburger-buns': 'bread', bagels: 'bread',
  'black-beans': 'beans', 'pinto-beans': 'beans', 'kidney-beans': 'beans', 'cannellini-beans': 'beans',
  chickpeas: 'beans', 'refried-beans': 'beans', 'brown-lentils': 'beans', 'red-lentils': 'beans',
};

/** The starches a dish leans on, so a rice main doesn't get a rice side. */
export function starchesOf(recipe: Recipe): Set<Starch> {
  const out = new Set<Starch>();
  for (const ri of recipe.ingredients) {
    const s = STARCH_BY_ID[ri.ingredientId];
    if (s) out.add(s);
  }
  return out;
}
