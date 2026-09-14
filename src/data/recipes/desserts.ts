// Desserts that fit around dinner: two bake in the oven while you eat, and one is made ahead and chilled.
// Ingredient amounts follow the originals (mapped to our catalog); steps are rewritten in our own words.
import { defineRecipe } from './define';

const bb = (slug: string) => ({ name: 'Budget Bytes', author: 'Beth Moncel', url: `https://www.budgetbytes.com/${slug}/` });
const rte = (slug: string) => ({ name: 'RecipeTin Eats', author: 'Nagi Maehashi', url: `https://www.recipetineats.com/${slug}/` });

export const DESSERTS = [
  defineRecipe({
    id: 'easy-apple-crisp', title: 'Easy Apple Crisp', credit: bb('easy-apple-crisp'),
    description: 'Warm spiced apples under a buttery oat and brown sugar crumble. It goes in the oven as you sit down to dinner and is ready when you are.',
    servings: 6, prep: 15, cook: 45, cuisine: 'American', diet: ['vegetarian'], slots: ['dinner'], difficulty: 1,
    ingredients: [
      'Filling',
      [2, 'lb', 'apple', 'peeled, cored and sliced'],
      [3, 'tbsp', 'sugar'],
      [1, 'tbsp', 'all-purpose-flour'],
      [1, 'tsp', 'ground-cinnamon'],
      [0.25, 'tsp', 'ground-ginger'],
      [0.125, 'tsp', 'ground-cloves'],
      [0.5, 'tsp', 'vanilla-extract'],
      'Topping',
      [0.25, 'cup', 'all-purpose-flour'],
      [0.33, 'cup', 'rolled-oats'],
      [0.5, 'cup', 'brown-sugar'],
      [0.125, 'tsp', 'salt'],
      [0.25, 'tsp', 'ground-cinnamon'],
      [4, 'tbsp', 'butter', 'cold, cut into pieces'],
    ],
    steps: [
      'Heat the oven to 350°F. Toss the apple slices in a 2-quart baking dish with the sugar, flour, spices and vanilla until evenly coated.',
      'In a bowl, mix the flour, oats, brown sugar, salt and cinnamon. Rub the butter in with your fingers until it looks like clumpy wet sand.',
      'Scatter the topping over the apples.',
      'Bake about 45 minutes, until the top is golden and the juices bubble at the edges. Let it sit 10 minutes before serving.',
    ],
    notes: 'Bake it alongside a 350–400°F dinner, or slide it in as dinner comes out. Leftovers keep 4 days in the fridge; rewarm in the oven to crisp the top. Great with vanilla ice cream.',
  }),
  defineRecipe({
    id: 'chocolate-self-saucing-pudding', title: 'Chocolate Self Saucing Pudding', credit: rte('chocolate-self-saucing-pudding'),
    description: 'A soft chocolate cake that makes its own fudgy sauce underneath as it bakes. Five minutes to mix, then 30 minutes in the oven during dinner.',
    servings: 6, prep: 10, cook: 30, cuisine: 'Australian', diet: ['vegetarian'], slots: ['dinner'], difficulty: 1,
    ingredients: [
      'Batter',
      [1, 'cup', 'all-purpose-flour'],
      [2.5, 'tsp', 'baking-powder'],
      [0.33, 'cup', 'sugar'],
      [0.25, 'cup', 'cocoa-powder'],
      [0.125, 'tsp', 'salt'],
      [0.5, 'cup', 'milk'],
      [50, 'g', 'butter', 'melted'],
      [1, 'ea', 'eggs'],
      [1, 'tsp', 'vanilla-extract'],
      'Sauce',
      [1, 'cup', 'brown-sugar'],
      [0.25, 'cup', 'cocoa-powder'],
      [1.25, 'cup', 'water', 'boiling'],
    ],
    steps: [
      'Heat the oven to 335°F (170°C) and butter a 5–6 cup baking dish.',
      'Whisk the flour, baking powder, sugar, cocoa and salt in a bowl. Add the milk, melted butter, egg and vanilla and stir just until smooth. Spread it in the dish.',
      'Mix the brown sugar and cocoa for the sauce and sprinkle it evenly over the batter.',
      'Gently pour the boiling water over the back of a spoon so it covers the top without making holes. Do not stir.',
      'Bake 30 minutes, until the top is set and springs back. The sauce will be underneath. Rest 5 minutes and spoon into bowls.',
    ],
    notes: 'Best eaten warm, straight from the oven. Leftovers keep 3 days in the fridge; microwave a bowl for 30 seconds and the sauce comes back.',
  }),
  defineRecipe({
    id: 'chocolate-mousse', title: 'Chocolate Mousse', credit: rte('chocolate-mousse'),
    description: 'Light, rich classic chocolate mousse with just five ingredients. Make it in the afternoon or the night before so it is set by dessert.',
    servings: 4, prep: 20, cook: 0, cuisine: 'French', diet: ['vegetarian', 'gluten-free'], slots: ['dinner'], difficulty: 2,
    ingredients: [
      [3, 'ea', 'eggs', 'separated, at room temperature'],
      [125, 'g', 'dark-chocolate', '70% cocoa, chopped'],
      [10, 'g', 'butter'],
      [0.5, 'cup', 'heavy-cream', 'cold'],
      [3, 'tbsp', 'sugar', 'superfine if you have it'],
    ],
    steps: [
      'Melt the chocolate and butter together in a bowl over barely simmering water (or in short microwave bursts), then let it cool until just warm.',
      'Whip the cream to soft peaks and keep it in the fridge.',
      'In a very clean bowl, beat the egg whites to soft peaks. Add the sugar a spoonful at a time and keep beating until glossy and stiff.',
      'Stir the egg yolks into the cooled chocolate. Fold in about a third of the whites to loosen it, then gently fold in the rest, followed by the whipped cream, until no streaks remain.',
      'Spoon into 4 glasses and chill at least 6 hours, until set.',
    ],
    notes: 'Make ahead: it needs 6 hours in the fridge and keeps 3 days covered. Contains raw eggs, so use very fresh ones and skip it for anyone pregnant or immunocompromised.',
  }),
];
