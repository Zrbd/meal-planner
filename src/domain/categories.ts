// Food categories ("what is it") — separate from the store aisle ("where do I find it").
import type { Ingredient } from './types';

export type CategoryId =
  | 'meat' | 'seafood' | 'plant-protein' | 'eggs-dairy' | 'cheese' | 'vegetables' | 'fruit' | 'herbs'
  | 'bread' | 'grains' | 'canned' | 'sauces' | 'oils' | 'spices' | 'baking' | 'nuts' | 'beverages' | 'other';

export const CATEGORIES: { id: CategoryId; label: string; emoji: string }[] = [
  { id: 'meat', label: 'Meat & poultry', emoji: '🍗' },
  { id: 'seafood', label: 'Seafood', emoji: '🐟' },
  { id: 'plant-protein', label: 'Beans, lentils & tofu', emoji: '🫘' },
  { id: 'eggs-dairy', label: 'Eggs & dairy', emoji: '🥚' },
  { id: 'cheese', label: 'Cheese', emoji: '🧀' },
  { id: 'vegetables', label: 'Vegetables', emoji: '🥕' },
  { id: 'fruit', label: 'Fruit', emoji: '🍎' },
  { id: 'herbs', label: 'Fresh herbs', emoji: '🌿' },
  { id: 'bread', label: 'Bread & tortillas', emoji: '🥖' },
  { id: 'grains', label: 'Pasta, rice & grains', emoji: '🍝' },
  { id: 'canned', label: 'Canned & jarred', emoji: '🥫' },
  { id: 'sauces', label: 'Sauces & condiments', emoji: '🥫' },
  { id: 'oils', label: 'Oils & vinegars', emoji: '🫒' },
  { id: 'spices', label: 'Spices & seasonings', emoji: '🧂' },
  { id: 'baking', label: 'Baking', emoji: '🧁' },
  { id: 'nuts', label: 'Nuts & seeds', emoji: '🥜' },
  { id: 'beverages', label: 'Drinks & cooking wine', emoji: '🧃' },
  { id: 'other', label: 'Other', emoji: '🛒' },
];

const set = (...ids: string[]) => new Set(ids);
const FRUIT = set('apple', 'banana', 'orange', 'strawberries', 'blueberries', 'mango', 'lemon', 'lime', 'avocado', 'frozen-berries', 'raisins');
const HERBS = set('cilantro', 'parsley', 'basil', 'fresh-dill', 'fresh-thyme', 'fresh-rosemary');
const CHEESE = set('parmesan', 'mozzarella', 'cheddar', 'mexican-cheese', 'feta', 'ricotta', 'cheese-slices', 'goat-cheese', 'cottage-cheese', 'cream-cheese');
const PLANT_PROTEIN = set('black-beans', 'chickpeas', 'kidney-beans', 'pinto-beans', 'cannellini-beans', 'refried-beans', 'brown-lentils', 'red-lentils', 'tofu');
const NUTS = set('almonds', 'peanuts', 'pepitas', 'peanut-butter', 'sesame-seeds', 'chia-seeds', 'tahini');
const SAUCES = set(
  'pesto', 'marinara', 'salsa', 'enchilada-sauce', 'tomato-sauce', 'chipotle-adobo', 'honey', 'maple-syrup', 'soy-sauce', 'fish-sauce',
  'miso', 'bbq-sauce', 'whole-grain-mustard', 'worcestershire', 'sriracha', 'dijon-mustard', 'mayonnaise', 'ketchup',
  'oyster-sauce', 'hoisin', 'mirin', 'red-curry-paste', 'dill-pickles', 'capers',
);
const OILS = set('olive-oil', 'vegetable-oil', 'sesame-oil', 'rice-vinegar', 'red-wine-vinegar', 'apple-cider-vinegar', 'balsamic-vinegar', 'ghee');
const GRAINS = set('refrigerated-tortellini');
const BEVERAGES = set('orange-juice', 'coffee', 'marsala-wine', 'dry-white-wine');

export function categoryOf(ing: Ingredient): CategoryId {
  if (ing.category) return ing.category;
  const id = ing.id;
  if (PLANT_PROTEIN.has(id)) return 'plant-protein';
  if (FRUIT.has(id)) return 'fruit';
  if (HERBS.has(id)) return 'herbs';
  if (CHEESE.has(id)) return 'cheese';
  if (NUTS.has(id)) return 'nuts';
  if (SAUCES.has(id)) return 'sauces';
  if (OILS.has(id)) return 'oils';
  if (GRAINS.has(id)) return 'grains';
  if (BEVERAGES.has(id)) return 'beverages';
  if (id === 'tuna') return 'seafood';
  switch (ing.aisle) {
    case 'meat': return 'meat';
    case 'seafood': return 'seafood';
    case 'produce': return 'vegetables';
    case 'frozen': return 'vegetables';
    case 'dairy': return 'eggs-dairy';
    case 'bakery': return 'bread';
    case 'pasta-grains': return 'grains';
    case 'canned': return 'canned';
    case 'international': return 'sauces';
    case 'oils-condiments': return 'sauces';
    case 'spices': return 'spices';
    case 'baking': return 'baking';
    case 'snacks': return 'nuts';
    case 'beverages': return 'beverages';
    default: return 'other';
  }
}

export const categoryInfo = (id: CategoryId) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
