// More recipes adapted from Budget Bytes (Beth Moncel). Ingredient amounts follow the original
// (mapped to our catalog); steps are rewritten in our own words. See each credit link for the full post and notes.
import { defineRecipe } from './define';

const bb = (slug: string) => ({ name: 'Budget Bytes', author: 'Beth Moncel', url: `https://www.budgetbytes.com/${slug}/` });

export const BUDGET_BYTES_33 = [
  defineRecipe({
    id: 'baked-chimichurri-cod-bowls', title: 'Baked Chimichurri Fish Bowls', credit: bb('baked-chimichurri-fish-bowls'),
    description: 'Tender cod baked under a bright parsley-cilantro chimichurri, served over rice with a lemony shredded cabbage and carrot slaw.',
    servings: 4, prep: 30, cook: 15, cuisine: 'Argentinian', protein: 'fish', diet: [], difficulty: 2,
    ingredients: [
      'Slaw',
      [4, 'cup', 'cabbage', 'shredded very thin (½ head; red cabbage is traditional)'],
      [1, 'ea', 'carrot', 'shredded'],
      [2, 'tbsp', 'cilantro', 'a handful, roughly chopped'],
      [1, 'ea', 'lemon', '2 tbsp juice (or lime)'],
      [1, 'tbsp', 'vegetable-oil'],
      [0.5, 'tsp', 'salt'],
      'Chimichurri',
      [0.5, 'cup', 'olive-oil'],
      [0.25, 'cup', 'red-wine-vinegar'],
      [1, 'cup', 'parsley', 'packed flat-leaf'],
      [0.5, 'cup', 'cilantro', 'packed'],
      [3, 'clove', 'garlic'],
      [1, 'tsp', 'dried-oregano'],
      [0.5, 'tsp', 'ground-cumin'],
      [0.25, 'tsp', 'red-pepper-flakes'],
      [0.5, 'tsp', 'salt'],
      'Bowls',
      [20, 'oz', 'cod', '4 portions, about 5 oz each'],
      [4, 'cup', 'white-rice', 'cooked'],
    ],
    steps: [
      'Make the slaw first. Slice the cabbage as thinly as possible, shred the carrot, and toss both with the cilantro, lemon juice, oil, and salt. Let it sit at least 30 minutes to soften, stirring now and then.',
      'Pulse all the chimichurri ingredients in a food processor until the herbs are finely chopped (or mince by hand and stir together).',
      'Heat the oven to 400°F. Put the cod in a baking dish and spoon over half the chimichurri, saving the rest.',
      'Bake 12–15 minutes until the fish just flakes.',
      'Build bowls with rice, a heaping cup of slaw, and the fish, then drizzle with the remaining chimichurri.',
    ],
    notes: 'Cabbage is a long-keeper, lasting 1–2 months whole in the crisper. Once cut, wrap it tightly and use it within a week. Chimichurri is a great way to use up parsley and cilantro before they wilt. It keeps 1 week in the fridge with a thin layer of oil on top and freezes in ice cube trays for 3 months. Thaw frozen cod overnight in the fridge and pat it dry before baking.',
  }),
  defineRecipe({
    id: 'chinese-steamed-eggs-silky', title: 'Chinese Steamed Eggs', credit: bb('chinese-steamed-eggs'),
    description: 'A silky, custard-like savory egg dish made with just eggs, warm water, and salt, gently steamed and finished with your favorite toppings.',
    servings: 2, prep: 5, cook: 10, cuisine: 'Chinese', protein: 'eggs', diet: [], slots: ['breakfast', 'lunch'], difficulty: 1,
    ingredients: [
      [2, 'ea', 'eggs', 'large'],
      [0.25, 'tsp', 'salt'],
      [1, 'cup', 'water', 'warm'],
      [1, 'tsp', 'soy-sauce', 'topping', 'optional'],
      [0.5, 'tsp', 'sesame-oil', 'topping', 'optional'],
      [1, 'ea', 'green-onion', 'sliced, topping', 'optional'],
    ],
    steps: [
      'Gently whisk the eggs and salt about 1 minute until small bubbles form.',
      'Whisk in the warm water until fully combined.',
      'Strain through a fine sieve into 2 small ramekins, cover with foil or plastic wrap, and poke a small steam vent.',
      'Set a steamer rack in a pot with water just below it, cover, and bring to a boil. Add the ramekins, lower to medium-low, cover, and steam 10 minutes.',
      'Top with soy sauce, sesame oil, and green onion and eat right away.',
    ],
    notes: 'Low heat is the key to a smooth, bubble-free surface. This is a good use for eggs nearing their date, since older eggs are just as silky here. Eggs keep 3–5 weeks past purchase on a fridge shelf (not the door). Best eaten fresh.',
  }),
  defineRecipe({
    id: 'cheesy-pinto-beans-jalapeno', title: 'Cheesy Pinto Beans', credit: bb('cheesy-pinto-beans'),
    description: 'A 20-minute side or meatless main: half-puréed pinto beans with garlic, jalapeño, smoky spices, and melted cheddar, great over rice.',
    servings: 4, prep: 10, cook: 10, cuisine: 'Mexican', protein: 'beans', diet: [], difficulty: 1,
    ingredients: [
      [2, 'clove', 'garlic', 'minced'],
      [1, 'ea', 'jalapeno', 'stemmed, seeded, finely diced', 'optional'],
      [1, 'tbsp', 'vegetable-oil'],
      [2, 'can', 'pinto-beans', '15 oz each, one undrained, one drained'],
      [0.25, 'tsp', 'smoked-paprika'],
      [0.25, 'tsp', 'ground-cumin'],
      [0.125, 'tsp', 'black-pepper', 'freshly cracked'],
      [0.5, 'tsp', 'sriracha', 'or 2 dashes of your hot sauce'],
      [0.5, 'cup', 'cheddar', 'shredded'],
    ],
    steps: [
      'Sauté the garlic and jalapeño in the oil in a pot over medium about 1 minute until fragrant.',
      'Purée one can of beans with its liquid in a blender until smooth.',
      'Add the purée and the second (drained) can of beans to the pot.',
      'Stir in the paprika, cumin, pepper, and hot sauce and heat through, stirring now and then.',
      'Stir in the cheddar until melted, taste, and adjust the seasoning.',
    ],
    notes: 'A pantry-rescue side, since canned beans keep years. Jalapeños last 1–2 weeks whole and dry in the crisper, and you can freeze them whole to dice straight from frozen. Blocks of cheddar last longer than pre-shredded. Wrap the cut face in parchment, then plastic. Leftovers keep 4 days and freeze well.',
  }),
];
