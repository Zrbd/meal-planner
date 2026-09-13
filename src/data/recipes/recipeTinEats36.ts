// More recipes adapted from RecipeTin Eats (Nagi Maehashi). Ingredient amounts follow the original
// (mapped to our catalog); steps are rewritten in our own words. See each credit link for the full post and notes.
import { defineRecipe } from './define';

const rte = (slug: string) => ({ name: 'RecipeTin Eats', author: 'Nagi Maehashi', url: `https://www.recipetineats.com/${slug}/` });

export const RECIPETIN_EATS_36 = [
  defineRecipe({
    id: 'greek-marinated-chickpea-spinach-feta-salad', title: 'Greek Marinated Chickpea Salad', credit: rte('chickpea-salad'),
    description: 'Warm chickpeas soaked in an oregano red wine vinaigrette, tossed with spinach, tomatoes, quick-pickled red onion, roasted peppers, and feta.',
    servings: 4, prep: 10, cook: 5, cuisine: 'Greek', protein: 'beans', diet: [], slots: ['lunch', 'dinner'], difficulty: 1,
    ingredients: [
      [2, 'can', 'chickpeas', 'well drained'],
      'Dressing',
      [2, 'tbsp', 'red-wine-vinegar'],
      [5, 'tbsp', 'olive-oil', 'extra virgin'],
      [1, 'clove', 'garlic', 'minced'],
      [2, 'tsp', 'dried-oregano'],
      [0.5, 'tsp', 'dijon-mustard'],
      [0.75, 'tsp', 'salt'],
      [0.75, 'tsp', 'black-pepper'],
      'Quick-pickled onion',
      [0.5, 'ea', 'red-onion', 'finely sliced'],
      [0.5, 'cup', 'red-wine-vinegar'],
      [1, 'tsp', 'sugar'],
      [0.5, 'tsp', 'salt'],
      'Salad',
      [8, 'oz', 'cherry-tomatoes', 'halved'],
      [3, 'cup', 'spinach', 'packed, thinly sliced'],
      [3, 'oz', 'feta'],
      [0.75, 'cup', 'roasted-red-peppers', 'drained and sliced', 'optional'],
    ],
    steps: [
      'Shake the dressing ingredients in a jar.',
      'Mix the onion, vinegar, sugar, and salt and set aside 30 minutes until the onion softens, then drain. (In a hurry, microwave 2 minutes and cool 10.)',
      'Toss the chickpeas with half the dressing in a microwave-safe bowl and heat 1½ minutes, stirring every 30 seconds.',
      'Let them marinate 20 minutes; warm chickpeas soak up more flavor.',
      'Put the spinach in a big bowl and add the chickpeas with all their dressing, the tomatoes, pickled onion, and peppers.',
      'Pour over the remaining dressing, toss, and crumble the feta on top.',
    ],
    notes: 'The marinated chickpeas and pickled onions keep 5 days in the fridge, so prep them ahead and add spinach when serving. The dressed salad is best within a day. Opened roasted peppers keep about 2 weeks in the fridge if the peppers stay covered in their liquid. Sliced spinach is forgiving, so it is a good use for leaves that are no longer crisp. Store feta in its brine.',
  }),
  defineRecipe({
    id: 'penne-alla-vodka-creamy-tomato-parmesan', title: 'Penne alla Vodka', credit: rte('vodka-pasta'),
    description: 'The trattoria classic: penne coated in a rich, rust-colored sauce of caramelized tomato paste, cream, and Parmesan, with a pinch of chili.',
    servings: 4, prep: 5, cook: 15, cuisine: 'Italian', protein: 'vegetarian', diet: [], slots: ['dinner'], difficulty: 1,
    ingredients: [
      [1, 'lb', 'penne', 'or ziti or rigatoni'],
      [2, 'tsp', 'salt', 'for the pasta water'],
      [1.5, 'tbsp', 'olive-oil'],
      [0.5, 'ea', 'yellow-onion', 'small, very finely diced'],
      [2, 'clove', 'garlic', 'finely minced'],
      [0.5, 'cup', 'tomato-paste'],
      [1.25, 'cup', 'heavy-cream'],
      [0.33, 'cup', 'chicken-broth', 'alcohol-free option; the original uses vodka'],
      [0.5, 'tsp', 'red-pepper-flakes', '', 'optional'],
      [0.75, 'tsp', 'salt'],
      [0.125, 'tsp', 'black-pepper', 'a pinch'],
      [1, 'cup', 'parmesan', 'freshly grated, loosely packed, plus more to serve'],
      [2, 'tsp', 'parsley', 'finely chopped', 'optional'],
    ],
    steps: [
      'Cook the pasta in well-salted boiling water until al dente. Before draining, stir it and scoop out a cup of the starchy water.',
      'Meanwhile, heat the oil in a large pan over medium-high. Cook the onion and garlic 1½ minutes until translucent.',
      'Add the tomato paste and stir constantly 2 minutes until it darkens. Lower the heat if it catches.',
      'Stir in the cream until the paste dissolves, then add the chili, salt, pepper, and broth (or vodka). Simmer on low 3 minutes, stirring.',
      'Stir in the Parmesan until melted and turn off the heat until the pasta is ready.',
      'Add the pasta and ½ cup pasta water and toss over medium 1–1½ minutes until glossy and coated, loosening with more water if needed.',
      'Serve right away with extra Parmesan and parsley.',
    ],
    notes: 'Best fresh. Leftovers keep 3 days; reheat gently with a splash of water or milk, since the sauce tightens as it cools. Freeze leftover tomato paste in tablespoon dollops. Opened heavy cream keeps about a week, and this recipe is a good way to use it before it turns; freeze extra in ice cube trays. A block of Parmesan lasts for weeks wrapped in wax paper, and the rind can go in soups.',
  }),
];
