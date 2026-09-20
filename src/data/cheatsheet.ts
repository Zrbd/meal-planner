// The card taped inside the cupboard door, minus the cupboard door. Conversions people actually
// look up mid-cook, plus the temperatures worth getting right.
export interface CheatRow {
  from: string;
  to: string;
  note?: string;
}

export interface CheatSection {
  id: string;
  title: string;
  rows: CheatRow[];
}

export const CHEAT_SHEET: CheatSection[] = [
  {
    id: 'volume',
    title: 'Volume',
    rows: [
      { from: '3 teaspoons', to: '1 tablespoon' },
      { from: '4 tablespoons', to: '¼ cup' },
      { from: '5 tbsp + 1 tsp', to: '⅓ cup' },
      { from: '8 tablespoons', to: '½ cup' },
      { from: '16 tablespoons', to: '1 cup' },
      { from: '1 cup', to: '8 fl oz · 237 ml' },
      { from: '1 pint', to: '2 cups · 473 ml' },
      { from: '1 quart', to: '4 cups · 946 ml' },
      { from: '1 gallon', to: '16 cups · 3.79 l' },
      { from: '1 tablespoon', to: '15 ml' },
      { from: '1 teaspoon', to: '5 ml' },
    ],
  },
  {
    id: 'weight',
    title: 'Weight',
    rows: [
      { from: '1 ounce', to: '28 g' },
      { from: '4 ounces', to: '113 g' },
      { from: '8 ounces', to: '227 g' },
      { from: '1 pound', to: '454 g' },
      { from: '2.2 pounds', to: '1 kg' },
      { from: '1 stick butter', to: '4 oz · 113 g · 8 tbsp' },
    ],
  },
  {
    id: 'cups',
    title: 'Cups to grams',
    rows: [
      { from: '1 cup all-purpose flour', to: '125 g', note: 'Spooned and levelled; scooping gives 145 g.' },
      { from: '1 cup bread flour', to: '130 g' },
      { from: '1 cup granulated sugar', to: '200 g' },
      { from: '1 cup brown sugar', to: '213 g', note: 'Packed.' },
      { from: '1 cup powdered sugar', to: '120 g' },
      { from: '1 cup rice, uncooked', to: '185 g' },
      { from: '1 cup rolled oats', to: '90 g' },
      { from: '1 cup water or milk', to: '240 g' },
      { from: '1 cup oil', to: '218 g' },
      { from: '1 cup honey', to: '340 g' },
      { from: '1 cup cocoa powder', to: '85 g' },
      { from: '1 cup grated parmesan', to: '90 g' },
      { from: '1 cup chopped nuts', to: '120 g' },
    ],
  },
  {
    id: 'oven',
    title: 'Oven',
    rows: [
      { from: '250 °F', to: '120 °C · gas ½' },
      { from: '300 °F', to: '150 °C · gas 2' },
      { from: '325 °F', to: '165 °C · gas 3' },
      { from: '350 °F', to: '175 °C · gas 4' },
      { from: '375 °F', to: '190 °C · gas 5' },
      { from: '400 °F', to: '205 °C · gas 6' },
      { from: '425 °F', to: '220 °C · gas 7' },
      { from: '450 °F', to: '230 °C · gas 8' },
      { from: 'Convection', to: 'Drop 25 °F / 15 °C' },
    ],
  },
  {
    id: 'doneness',
    title: 'Cooked through',
    rows: [
      { from: 'Chicken & turkey', to: '165 °F · 74 °C', note: 'Thickest part, not touching bone.' },
      { from: 'Ground poultry', to: '165 °F · 74 °C' },
      { from: 'Pork chops & roasts', to: '145 °F · 63 °C', note: 'Rest 3 minutes; a little pink is fine.' },
      { from: 'Pulled pork', to: '195–203 °F · 90–95 °C', note: 'Cooked past done so the collagen gives up.' },
      { from: 'Ground pork', to: '160 °F · 71 °C' },
      { from: 'Shrimp', to: 'Opaque, curled into a C', note: 'A tight O means overcooked.' },
      { from: 'Eggs, set custard', to: '170 °F · 77 °C' },
      { from: 'Bread, lean loaf', to: '200–210 °F · 93–99 °C' },
      { from: 'Enriched bread', to: '190 °F · 88 °C' },
    ],
  },
  {
    id: 'sugar',
    title: 'Sugar stages',
    rows: [
      { from: 'Thread', to: '230 °F · 110 °C' },
      { from: 'Soft ball', to: '235 °F · 113 °C' },
      { from: 'Firm ball', to: '245 °F · 118 °C' },
      { from: 'Hard crack', to: '300 °F · 150 °C' },
      { from: 'Caramel', to: '340 °F · 170 °C' },
    ],
  },
  {
    id: 'swaps',
    title: 'Emergency swaps',
    rows: [
      { from: '1 cup buttermilk', to: '1 cup milk + 1 tbsp lemon juice, 10 min' },
      { from: '1 tsp baking powder', to: '¼ tsp baking soda + ½ tsp cream of tartar' },
      { from: '1 egg (binding)', to: '1 tbsp ground flax + 3 tbsp water, 5 min' },
      { from: '1 cup self-rising flour', to: '1 cup flour + 1½ tsp baking powder + ¼ tsp salt' },
      { from: '1 cup sour cream', to: '1 cup plain Greek yogurt' },
      { from: '1 cup heavy cream (cooking)', to: '¾ cup milk + ¼ cup melted butter' },
      { from: '1 tbsp cornstarch', to: '2 tbsp flour' },
      { from: '1 cup white wine', to: '1 cup broth + 1 tsp vinegar' },
      { from: '1 tsp dried herb', to: '1 tbsp fresh' },
      { from: '1 clove garlic', to: '⅛ tsp garlic powder' },
    ],
  },
  {
    id: 'pans',
    title: 'Pan sizes',
    rows: [
      { from: '9 × 13 in', to: '23 × 33 cm · ~14 cups' },
      { from: '8 in square', to: '20 cm · ~8 cups' },
      { from: '9 in round', to: '23 cm · ~6 cups' },
      { from: '9 × 5 in loaf', to: '23 × 13 cm · ~8 cups' },
      { from: 'Two 9 in rounds', to: 'One 9 × 13 in', note: 'Same batter, add about 10 minutes.' },
    ],
  },
  {
    id: 'rice',
    title: 'Rice & grains (per 1 cup dry)',
    rows: [
      { from: 'Long-grain white', to: '1¾ cups water · 18 min' },
      { from: 'Basmati', to: '1½ cups water · 15 min, rinse first' },
      { from: 'Jasmine', to: '1¼ cups water · 15 min' },
      { from: 'Brown rice', to: '2¼ cups water · 45 min' },
      { from: 'Quinoa', to: '1¾ cups water · 15 min, rinse first' },
      { from: 'Couscous', to: '1 cup boiling water · 5 min off heat' },
      { from: 'Dried beans', to: 'Soak overnight · 1–2 h simmer' },
      { from: 'Lentils, brown', to: '2½ cups water · 25 min' },
    ],
  },
];

/** Case-insensitive search across every row, for the sheet's filter box. */
export function searchCheatSheet(query: string): CheatSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return CHEAT_SHEET;
  return CHEAT_SHEET.map((s) => ({
    ...s,
    rows: s.rows.filter((r) => `${r.from} ${r.to} ${r.note ?? ''}`.toLowerCase().includes(q)),
  })).filter((s) => s.rows.length > 0);
}
