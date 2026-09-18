// Side dishes that get planned alongside a main. Adapted from Budget Bytes (Beth Moncel);
// amounts follow the originals, steps are rewritten in our own words.
import { defineRecipe } from './define';

const bb = (slug: string) => ({ name: 'Budget Bytes', author: 'Beth Moncel', url: `https://www.budgetbytes.com/${slug}/` });

export const SIDES = [
  defineRecipe({
    id: 'side-roasted-broccoli', title: 'Oven Roasted Broccoli', credit: bb('perfect-oven-roasted-broccoli'),
    description: 'Broccoli florets roasted hot until the edges are brown and crisp and the stems are just tender.',
    servings: 4, prep: 5, cook: 25, cuisine: 'American', diet: ['vegetarian', 'vegan', 'gluten-free'], role: 'side', tags: ['side', 'vegetable'],
    ingredients: [
      [2, 'lb', 'broccoli', 'cut into bite-sized florets'],
      [2, 'tbsp', 'olive-oil'], [0.25, 'tsp', 'salt'], [0.25, 'tsp', 'black-pepper'],
    ],
    steps: [
      'Heat the oven to 400°F (205°C) and cut the broccoli into bite-sized florets.',
      'Spread the florets on a baking sheet, drizzle with the oil, season with the salt and pepper, and toss until every piece is coated.',
      'Roast 20–25 minutes, stirring once around the 15-minute mark, until the edges are as browned as you like.',
    ],
    notes: 'Crowding the pan steams the broccoli instead of roasting it — use two sheets if you have to.',
  }),
  defineRecipe({
    id: 'side-cornbread', title: 'Everyday Cornbread', credit: bb('everyday-cornbread'),
    description: 'A plain, slightly sweet skillet cornbread from pantry staples — the side for chili, beans, or greens.',
    servings: 8, prep: 10, cook: 20, cuisine: 'American', diet: ['vegetarian'], role: 'side', tags: ['side', 'bread'], pairsWith: ['turkey-chili', 'slow-cooker-vegetarian-lentil-chili', 'bbq-pinto-beans-greens-rice'],
    ingredients: [
      [1, 'cup', 'cornmeal'], [1, 'cup', 'all-purpose-flour'], [0.25, 'cup', 'sugar'],
      [1, 'tbsp', 'baking-powder'], [0.5, 'tsp', 'salt'],
      [1, 'cup', 'milk'], [1, 'ea', 'eggs'], [0.25, 'cup', 'vegetable-oil'],
    ],
    steps: [
      'Heat the oven to 425°F (220°C) and grease a 9-inch pie plate or 8×8 baking dish.',
      'Whisk the cornmeal, flour, sugar, baking powder, and salt together until evenly combined.',
      'In another bowl, whisk the milk, egg, and oil.',
      'Pour the wet into the dry and stir just until no dry patches are left — overmixing makes it tough.',
      'Scrape the batter into the dish and bake about 20 minutes, until the top and edges are golden.',
    ],
  }),
  defineRecipe({
    id: 'side-creamy-coleslaw', title: 'Creamy Coleslaw', credit: bb('simple-creamy-coleslaw'),
    description: 'Sweet-tangy cabbage slaw for pulled pork, barbecue plates, or anything fried.',
    servings: 8, prep: 15, cook: 0, cuisine: 'American', diet: ['vegetarian', 'gluten-free'], role: 'side', tags: ['side', 'salad', 'no-cook'], pairsWith: ['quick-skillet-bbq-chicken', 'slow-cooker-bbq-chicken', 'grilled-bbq-chicken-breasts'],
    ingredients: [
      'Dressing',
      [0.67, 'cup', 'mayonnaise'], [1, 'tbsp', 'honey'], [2, 'tsp', 'dijon-mustard'], [2, 'tsp', 'red-wine-vinegar'],
      [0.5, 'tsp', 'salt'], [0.25, 'tsp', 'black-pepper'],
      'Slaw',
      [12, 'oz', 'cabbage', 'about half a head, finely shredded'], [4, 'oz', 'carrot', 'shredded'], [6, 'ea', 'green-onion', 'sliced'],
    ],
    steps: [
      'Shred the cabbage and carrot as thinly and evenly as you can, and slice the green onions.',
      'Stir the mayonnaise, honey, mustard, vinegar, salt, and pepper together until smooth.',
      'Pour the dressing over the vegetables and toss until everything is coated.',
      'Eat right away while it is crunchy, or chill an hour for a softer, more seasoned slaw.',
    ],
    notes: 'Keeps about 3 days covered in the fridge; it loosens as the cabbage releases water.',
  }),
  defineRecipe({
    id: 'side-roasted-potatoes', title: 'Crispy Oven Roasted Potatoes', credit: bb('oven-roasted-potatoes'),
    description: 'Parboiled russets roughed up and roasted until the outsides shatter and the middles stay fluffy.',
    servings: 4, prep: 15, cook: 48, cuisine: 'American', diet: ['vegetarian', 'vegan', 'gluten-free'], role: 'side', tags: ['side', 'potato'],
    ingredients: [
      [2, 'lb', 'potato', 'russets, peeled and cut in 1–2 inch pieces'],
      [1, 'tbsp', 'salt', 'for the water'], [0.5, 'tsp', 'baking-soda'],
      [3, 'tbsp', 'olive-oil'], [1, 'tsp', 'salt', 'divided'], [0.25, 'tsp', 'black-pepper'], [0.5, 'tsp', 'garlic-powder'],
      [0.5, 'tbsp', 'parsley', 'minced'],
    ],
    steps: [
      'Heat the oven to 425°F (220°C). Peel the potatoes and cut them into 1–2 inch chunks.',
      'Bring 2 quarts of water with the tablespoon of salt to a boil, add the potatoes and the baking soda, and boil 8 minutes, until a fork goes in easily.',
      'Drain well and let them steam dry a minute, then toss with the oil, half the teaspoon of salt, the pepper, and the garlic powder. The edges should look scuffed and starchy.',
      'Spread on a parchment-lined sheet and roast 20 minutes, flip, then roast 20 minutes more until deep golden.',
      'Finish with the rest of the salt and the parsley.',
    ],
  }),
  defineRecipe({
    id: 'side-garlic-bread', title: 'Homemade Garlic Bread', credit: bb('garlic-bread'),
    description: 'A split loaf spread with garlic butter and baked until the edges crisp.',
    servings: 12, prep: 10, cook: 15, cuisine: 'Italian', diet: ['vegetarian'], role: 'side', tags: ['side', 'bread'],
    ingredients: [
      [1, 'ea', 'baguette', 'French or Italian loaf'],
      [6, 'tbsp', 'butter', 'room temperature'], [2, 'tbsp', 'olive-oil'],
      [4, 'clove', 'garlic', 'minced'], [2, 'tbsp', 'parsley', 'chopped'],
      [0.125, 'tsp', 'salt'], [0.25, 'tsp', 'garlic-powder'],
    ],
    steps: [
      'Heat the oven to 400°F (205°C). Mash the soft butter with the oil, garlic, garlic powder, parsley, and salt until fairly smooth.',
      'Cut the loaf crosswise into manageable pieces, then split each lengthwise and lay them cut side up on a baking sheet.',
      'Spread the garlic butter over all the cut surfaces, right to the edges.',
      'Bake 10–15 minutes, until the edges are golden and crisp. Cut into 2-inch pieces and serve hot.',
    ],
    notes: 'Assemble it, wrap tight, and freeze — bake from frozen at 400°F for 10–15 minutes.',
  }),
  defineRecipe({
    id: 'side-sauteed-green-beans', title: 'Sautéed Green Beans', credit: bb('sauteed-green-beans'),
    description: 'Fresh green beans blistered in a hot skillet with garlic and a little heat.',
    servings: 4, prep: 5, cook: 10, cuisine: 'American', diet: ['vegetarian', 'vegan', 'gluten-free'], role: 'side', tags: ['side', 'vegetable', 'quick'],
    ingredients: [
      [1, 'lb', 'green-beans', 'trimmed'],
      [1.5, 'tbsp', 'olive-oil'], [2, 'clove', 'garlic', 'minced'],
      [0.5, 'tsp', 'onion-powder'], [0.25, 'tsp', 'red-pepper-flakes'], [0.5, 'tsp', 'salt'], [0.125, 'tsp', 'black-pepper'],
    ],
    steps: [
      'Rinse and trim the beans and pat them dry — wet beans steam instead of searing.',
      'Heat the oil in a large skillet over medium-high, then add the beans, garlic, onion powder, red pepper flakes, salt, and pepper.',
      'Sauté 8–10 minutes, tossing now and then, until blistered in spots and as tender as you like.',
    ],
    notes: 'Use fresh, not frozen; frozen beans give off too much water to brown.',
  }),
  defineRecipe({
    id: 'side-seasoned-rice', title: 'Seasoned Rice', credit: bb('snap-challenge-seasoned-rice'),
    description: 'Plain rice turned into a proper side with garlic, thyme, and a pinch of heat.',
    servings: 6, prep: 5, cook: 45, cuisine: 'American', diet: ['vegetarian', 'vegan', 'gluten-free'], role: 'side', tags: ['side', 'grain'],
    ingredients: [
      [2, 'cup', 'brown-rice', 'long grain'],
      [0.5, 'tsp', 'garlic-powder'], [0.5, 'tsp', 'dried-thyme'], [0.25, 'tsp', 'red-pepper-flakes', '', 'optional'],
      [0.75, 'tsp', 'salt'], [4, 'cup', 'water'],
    ],
    steps: [
      'Stir the rice, garlic powder, thyme, red pepper flakes, salt, and water together in a heavy pot.',
      'Cover, bring to a boil over high heat, then turn the heat to low and simmer 40 minutes.',
      'Turn off the heat and let it sit, still covered, 5 minutes. Fluff with a fork and serve.',
    ],
    notes: 'Works with white rice too — use the water and time on your bag, keeping the seasonings the same.',
  }),
];
