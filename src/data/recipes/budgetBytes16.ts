// More recipes adapted from Budget Bytes (Beth Moncel and contributors). Ingredient amounts follow the original
// (mapped to our catalog); steps are rewritten in our own words. See each credit link for the full post.
import { defineRecipe } from './define';

const bb = (slug: string) => ({ name: 'Budget Bytes', author: 'Beth Moncel', url: `https://www.budgetbytes.com/${slug}/` });

export const BUDGET_BYTES_16 = [
  defineRecipe({
    id: 'wilted-kale-lentil-salad', title: 'Wilted Kale and Lentil Salad', credit: bb('wilted-kale-and-lentil-salad'),
    description: 'A hearty warm salad of roasted sweet potato and red onion, tender brown lentils, and garlicky wilted kale with a cumin-cider vinegar finish.',
    servings: 4, prep: 30, cook: 45, cuisine: 'American', protein: 'vegetarian', diet: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'], slots: ['lunch', 'dinner'], difficulty: 1,
    ingredients: [
      [1, 'ea', 'sweet-potato', 'medium, peeled, 1-inch cubes'],
      [1, 'ea', 'red-onion', 'medium, thick strips'],
      [0.25, 'cup', 'olive-oil', 'divided'],
      [1, 'cup', 'brown-lentils', 'dry'],
      [1, 'bunch', 'kale', 'curly, stems removed, torn'],
      [1, 'clove', 'garlic', 'minced'],
      [1, 'tsp', 'ground-cumin'],
      [1, 'tbsp', 'apple-cider-vinegar', 'start with ½ tbsp'],
      [0.5, 'tsp', 'salt', 'to taste'], [0.25, 'tsp', 'black-pepper'],
    ],
    steps: [
      'Heat the oven to 400°F. Toss the sweet potato and onion with 2 tablespoons oil and a little salt and pepper on a foil-lined sheet and roast about 45 minutes until tender and browned at the edges.',
      'Meanwhile, sort the lentils for stones, drop them into boiling water, and simmer about 20 minutes until tender. Drain.',
      'Strip the kale from its stems, tear into bite-size pieces, and rinse.',
      'Warm the remaining oil and garlic in a large pot over medium-low for 2 minutes, then add the kale and stir just until it’s as wilted as you like.',
      'Off the heat, add the lentils and roasted vegetables. Season with cumin, cider vinegar, salt, and pepper, adding more vinegar to taste.',
    ],
    notes: 'Kale lasts about a week: store it unwashed, wrapped in a dry paper towel inside a bag. If it starts to wilt, this recipe cooks it anyway. Sweet potatoes keep 3+ weeks somewhere cool and dark, not the fridge. The salad keeps 4 days and is good warm or cold.',
  }),
  defineRecipe({
    id: 'sesame-glazed-salmon-green-beans', title: 'Sesame Glazed Salmon and Green Beans', credit: bb('sesame-glazed-salmon-and-green-beans'),
    description: 'Salmon marinated and pan-glazed in a sticky soy, ginger, and sesame sauce, served over green beans cooked in the rest of the glaze.',
    servings: 3, prep: 10, cook: 20, cuisine: 'Asian', protein: 'seafood', diet: ['dairy-free'], difficulty: 1,
    ingredients: [
      [11, 'oz', 'salmon', 'about ⅔ lb, cut into 3 pieces'],
      [11, 'oz', 'green-beans', 'about ⅔ lb, trimmed'],
      'Glaze',
      [3, 'tbsp', 'soy-sauce'],
      [2, 'tbsp', 'mirin', 'rice wine'],
      [2, 'tbsp', 'brown-sugar'],
      [0.5, 'tbsp', 'sesame-oil', 'toasted'],
      [1, 'clove', 'garlic', 'minced'],
      [1, 'inch', 'ginger', 'grated'],
      [1, 'tbsp', 'sesame-seeds'],
      [1, 'tbsp', 'cornstarch'],
    ],
    steps: [
      'Stir the glaze ingredients with 1 tablespoon water until the cornstarch dissolves.',
      'Put the salmon pieces in a zip-top bag with about half the glaze and marinate 15 minutes. Save the rest.',
      'Meanwhile, boil the green beans about 3 minutes until bright green and just tender, then drain.',
      'Cook the salmon in a lightly oiled nonstick skillet over medium-low, 3–5 minutes per side, until the glaze turns deep brown and the fish is cooked. Move to a plate.',
      'Add the beans and the reserved glaze to the skillet and toss about 3 minutes until the sauce thickens and coats them. Serve the salmon on top.',
    ],
    notes: 'Fresh salmon only lasts 1–2 days, so freeze it if your plan is later in the week and thaw overnight in the fridge. Green beans stay crisp about a week unwashed in a bag in the crisper. Trimmed beans can be blanched and frozen for months.',
  }),
];
