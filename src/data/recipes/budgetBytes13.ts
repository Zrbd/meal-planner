// More recipes adapted from Budget Bytes (Beth Moncel and contributors). Ingredient amounts follow the original
// (mapped to our catalog); steps are rewritten in our own words. See each credit link for the full post.
import { defineRecipe } from './define';

const bb = (slug: string) => ({ name: 'Budget Bytes', author: 'Beth Moncel', url: `https://www.budgetbytes.com/${slug}/` });

export const BUDGET_BYTES_13 = [
  defineRecipe({
    id: 'slow-roasted-herb-chicken-breasts', title: 'Slow-Roasted Herb Butter Chicken Breasts', credit: bb('herb-roasted-chicken-breasts'),
    description: 'Bone-in chicken breasts smeared with garlic herb butter, roasted low and covered until meltingly tender, then crisped at high heat.',
    servings: 4, prep: 15, cook: 110, cuisine: 'American', protein: 'chicken', diet: ['gluten-free'], difficulty: 1,
    ingredients: [
      [2, 'lb', 'chicken-breast', '2 split breasts, bone-in and skin-on'],
      [3, 'tbsp', 'butter', 'room temperature'],
      [2, 'clove', 'garlic', 'minced'],
      [1, 'tsp', 'dried-basil'], [1, 'tsp', 'dried-thyme'], [1, 'tsp', 'dried-rosemary', 'crumbled'],
      [0.5, 'tsp', 'salt'], [0.5, 'tsp', 'black-pepper'],
    ],
    steps: [
      'Heat the oven to 275°F and take the chicken out of the fridge while you mix the butter.',
      'Stir the soft butter with the garlic, herbs, salt, and pepper.',
      'Pat the chicken very dry (the butter won’t stick to damp or icy-cold skin), then smear the herb butter over both sides.',
      'Put the chicken in a deep baking dish, cover tightly with foil, and bake 90 minutes, basting once halfway.',
      'Uncover, baste again, raise the oven to 425°F, and bake about 20 minutes more, until the skin is deep golden and the meat reads 165°F.',
      'Rest 5–10 minutes, then slice or pull from the bone and drizzle with the pan juices.',
    ],
    notes: 'Very forgiving for meal prep: the slow roast keeps breast meat moist for 4 days of salads, wraps, and bowls. Mix a double batch of herb butter, roll it in plastic wrap, and freeze slices for months.',
  }),
  defineRecipe({
    id: 'honey-balsamic-chicken-tenders', title: 'Honey Balsamic Chicken Tenders', credit: bb('honey-balsamic-chicken-tenders'),
    description: 'Chicken strips marinated in balsamic and garlic, seared, then tossed in a glossy honey-balsamic butter glaze.',
    servings: 4, prep: 35, cook: 15, cuisine: 'American', protein: 'chicken', diet: ['gluten-free'], difficulty: 1,
    ingredients: [
      [1.5, 'lb', 'chicken-breast', '2 medium, cut into strips'],
      'Marinade',
      [0.25, 'cup', 'balsamic-vinegar'],
      [1, 'clove', 'garlic', 'minced'],
      [1, 'tbsp', 'olive-oil'],
      [0.25, 'tsp', 'salt'], [0.125, 'tsp', 'black-pepper'],
      'Glaze',
      [1, 'tbsp', 'olive-oil', 'for cooking'],
      [1, 'tbsp', 'butter'],
      [2, 'tbsp', 'balsamic-vinegar'],
      [3, 'tbsp', 'honey'],
    ],
    steps: [
      'Cut each breast diagonally into about 6 strips. Seal them in a bag with the marinade ingredients and refrigerate at least 30 minutes.',
      'Heat the oil in a large skillet over medium and brown the strips 2–3 minutes per side, in batches if needed. Set aside.',
      'Lower the heat to medium-low, add the butter and 2 tablespoons balsamic, and stir to lift the browned bits.',
      'Add the honey, bring to a simmer, and cook about 5 minutes until syrupy. Season with a pinch of salt and pepper.',
      'Return the chicken and toss to coat. Serve right away with rice or a salad.',
    ],
    notes: 'Balsamic vinegar and honey keep practically forever in the pantry, so this is a good plan when the fridge is bare. Marinate no longer than a few hours, since the acid starts to turn the chicken mushy.',
  }),
  defineRecipe({
    id: 'stone-soup', title: 'Stone Soup', credit: bb('stone-soup'),
    description: 'A big-batch, clean-out-the-crisper chicken and vegetable soup with drumsticks, carrots, celery, zucchini, cabbage, and potatoes.',
    servings: 9, prep: 15, cook: 75, cuisine: 'American', protein: 'chicken', diet: ['gluten-free', 'dairy-free'], slots: ['lunch', 'dinner'], difficulty: 1,
    ingredients: [
      [1, 'tbsp', 'olive-oil'],
      [1, 'ea', 'yellow-onion', 'diced'],
      [4, 'ea', 'carrot', 'peeled and chopped'],
      [3, 'ea', 'celery', 'stalks, diced'],
      [1, 'tsp', 'salt'], [0.5, 'tsp', 'black-pepper'],
      [1, 'tsp', 'dried-thyme'], [1, 'tsp', 'italian-seasoning'],
      [2, 'leaf', 'bay-leaves'],
      [4, 'ea', 'chicken-drumsticks'],
      [1, 'ea', 'zucchini', 'chopped'],
      [0.25, 'head', 'cabbage', 'small head, chopped (about 4 cups)'],
      [1, 'lb', 'potato', '4–5 red potatoes, large dice'],
      [3, 'clove', 'garlic', 'minced'],
      [6, 'cup', 'chicken-broth'],
    ],
    steps: [
      'Cook the onion, carrots, and celery in the oil in a large pot over medium with the salt, pepper, thyme, Italian seasoning, and bay leaves until glossy and starting to soften.',
      'Push the vegetables aside and brown the drumsticks on all sides in the bottom of the pot.',
      'Add the zucchini, cabbage, potatoes, and garlic, pour in the broth, and bring to a boil.',
      'Simmer about 1 hour, until the vegetables are soft and the chicken is cooked through.',
      'Pull the chicken off the bones, return the meat to the pot, remove the bay leaves, and adjust the salt and pepper.',
    ],
    notes: 'This is the ideal “use it up” soup: swap in whatever vegetables are going soft. Save the bones and vegetable peels in a freezer bag for stock. Keeps 5 days refrigerated, or freeze portions (the potatoes soften a little when thawed).',
  }),
];
