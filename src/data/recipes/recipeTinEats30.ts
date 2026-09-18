// More recipes adapted from RecipeTin Eats (Nagi Maehashi). Ingredient amounts follow the original
// (mapped to our catalog); steps are rewritten in our own words. See each credit link for the full post and notes.
import { defineRecipe } from './define';

const rte = (slug: string) => ({ name: 'RecipeTin Eats', author: 'Nagi Maehashi', url: `https://www.recipetineats.com/${slug}/` });

export const RECIPETIN_EATS_30 = [
  defineRecipe({
    id: 'sizzling-ginger-green-onion-fish-parcels', title: 'Sizzling Ginger Steamed Fish', credit: rte('sizzling-ginger-steamed-fish'),
    description: 'Delicate white fish steamed in foil parcels, then topped with ginger, green onion, soy, and sesame and finished with a dramatic pour of sizzling hot oil.',
    servings: 2, prep: 5, cook: 15, cuisine: 'Chinese', protein: 'fish', diet: [], difficulty: 2,
    ingredients: [
      [12, 'oz', 'cod', '2 thinnish skinless fillets, about 6 oz each'],
      [1, 'tsp', 'mirin', 'or dry white wine (the original uses cooking sake)'],
      [0.125, 'tsp', 'salt', 'a small pinch'],
      [0.125, 'tsp', 'white-pepper', 'a small pinch'],
      [0.5, 'cup', 'green-onion', 'green parts only, finely sliced on the diagonal'],
      [2, 'tbsp', 'ginger', 'finely julienned'],
      [0.5, 'ea', 'jalapeno', 'seeded and julienned (stands in for a large red chili)', 'optional'],
      [2, 'tsp', 'soy-sauce'],
      [2, 'tsp', 'sesame-oil', 'toasted'],
      [2, 'tbsp', 'vegetable-oil', 'or peanut oil'],
    ],
    steps: [
      'Heat the oven to 400°F (200°C).',
      'For each fillet, lay a sheet of parchment on a slightly larger sheet of foil and put the fish in the middle.',
      'Season both sides with a small pinch of salt and white pepper, drizzle ½ tsp mirin over each, and fold the parchment, then the foil, into sealed parcels.',
      'Bake on a tray about 12 minutes, until the fish flakes or reads 130°F.',
      'Open each parcel on a plate, folding the sides down into a boat to catch the juices, and rest 3 minutes while you heat the oil in a small pan until very hot.',
      'Pile the green onion, ginger, and chili on the fish, drizzle with soy and sesame oil, then pour the hot oil over so it sizzles. Eat right away, swiping the fish through the sauce.',
    ],
    notes: 'Uses a big handful of green onion greens, so it\'s perfect for a bunch that\'s starting to flag. To keep green onions crisp, stand them roots-down in a jar with an inch of water in the fridge, loosely bagged, and change the water every few days. Frozen cod works great: thaw overnight in the fridge (or in a sealed bag in cold water about 30 minutes) and pat very dry. Store peeled ginger in the freezer and julienne it half-thawed.',
  }),
  defineRecipe({
    id: 'fish-en-papillote-vegetables', title: 'Fish en Papillote (Fish in a Bag)', credit: rte('fish-en-papillote-recipe'),
    description: 'White fish baked in a sealed parcel on a bed of golden potatoes, zucchini, bell pepper, and red onion with dill, olive oil, and a splash of white wine.',
    servings: 2, prep: 20, cook: 20, cuisine: 'French', protein: 'fish', diet: [], difficulty: 2,
    ingredients: [
      [11, 'oz', 'cod', '2 skinless fillets about 5.5 oz each (snapper in the original)'],
      [3, 'tbsp', 'olive-oil', 'extra virgin, divided'],
      [7, 'oz', 'potato', 'fingerling or baby, peeled and sliced ¼ inch thick'],
      [1, 'ea', 'zucchini', 'sliced ¼ inch thick'],
      [1, 'ea', 'bell-pepper', 'red, sliced ¼ inch thick'],
      [0.5, 'ea', 'red-onion', 'cut into thin wedges'],
      [1, 'clove', 'garlic', 'finely minced'],
      [0.75, 'tsp', 'salt', 'divided'],
      [0.25, 'tsp', 'black-pepper', 'divided'],
      [2, 'tbsp', 'fresh-dill', 'about 6 sprigs'],
      [2, 'tbsp', 'dry-white-wine', 'or low-sodium vegetable broth'],
      [1, 'ea', 'lemon', 'wedges to serve'],
    ],
    steps: [
      'Heat the oven to 375°F (190°C).',
      'Cook the potatoes in 2 tbsp oil in a non-stick skillet over medium-high for 4 minutes, stirring, until lightly colored.',
      'Add the zucchini, pepper, onion, garlic, and half the salt and pepper and toss about 1 minute.',
      'Lay two 20-inch sheets of foil on the counter, each topped with a slightly smaller sheet of parchment, and divide the vegetables between them.',
      'Pat the fish dry, season with the rest of the salt and pepper, and set on the vegetables. Top each with dill, the remaining oil, and 1 tbsp wine.',
      'Seal: bring the long edges together and fold over twice, then fold each open end into a triangle and roll it over twice to lock.',
      'Bake on a tray 18 minutes, rest 3 minutes, then open at the table and squeeze over lemon.',
    ],
    notes: 'A good fridge clean-out, since almost any quick-cooking vegetable works in the parcel. Assemble parcels up to 4 hours ahead and keep them in the fridge. Zucchini and bell peppers last about 1 week dry in the crisper; store peppers whole and unwashed. Thaw frozen fish in the fridge overnight and pat dry. Chop leftover dill and freeze it in olive oil in an ice cube tray.',
  }),
  defineRecipe({
    id: 'oven-baked-fluffy-coconut-rice', title: 'Restaurant Style Coconut Rice', credit: rte('fluffy-coconut-rice'),
    description: 'Lightly sweet, fragrant coconut milk jasmine rice baked in the oven so every grain comes out fluffy and separate. Perfect with curries.',
    servings: 4, prep: 5, cook: 40, cuisine: 'Thai', protein: 'vegetarian', diet: [], slots: ['dinner'], difficulty: 1,
    role: 'side', tags: ['side'],
    ingredients: [
      [2, 'cup', 'white-rice', 'jasmine'],
      [1, 'ea', 'coconut-milk', '14 oz can, full fat or light'],
      [1, 'cup', 'water'],
      [5, 'tsp', 'sugar'],
      [0.5, 'tsp', 'salt'],
    ],
    steps: [
      'Rinse the rice until the water runs mostly clear, soak it in fresh water 1 hour, then drain well for 5 minutes.',
      'Heat the oven to 400°F (200°C) and spread the rice in an 8-inch square metal or ceramic pan.',
      'Bring the coconut milk, water, sugar, and salt to a boil in a saucepan, stirring to dissolve the sugar.',
      'Quickly pour the hot liquid over the rice, stir to level, cover tightly with foil, and bake 40 minutes.',
      'Check the liquid is absorbed (a little coconut cream on top is normal), then rest covered 15 minutes without skipping it.',
      'Fluff gently with a rubber spatula and serve.',
    ],
    notes: 'Shelf-stable ingredients, so this is always ready to go. Cool leftover rice quickly and refrigerate within an hour; it keeps 3 days, or freeze it flat in bags for 1 month and microwave from frozen with a splash of water. Transfer leftover coconut milk from an opened can to a jar and use it within 5 days, or freeze it.',
  }),
];
