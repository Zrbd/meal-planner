// Built-in ingredient catalog. Quantities in each ingredient's baseUnit.
// density = g per ml, gramsPerEach = weight of one item. Packages = common US store sizes.
import type { AisleId, Ingredient, Location } from '../domain/types';

const oz = (n: number) => Math.round(n * 28.3495 * 10) / 10;
const lb = (n: number) => Math.round(n * 453.592 * 10) / 10;
const floz = (n: number) => Math.round(n * 29.5735 * 10) / 10;

const DEFAULT_LOCATION: Record<AisleId, Location> = {
  produce: 'fridge', meat: 'fridge', seafood: 'fridge', dairy: 'fridge', bakery: 'pantry', frozen: 'freezer',
  canned: 'pantry', 'pasta-grains': 'pantry', baking: 'pantry', spices: 'pantry', 'oils-condiments': 'pantry',
  international: 'pantry', snacks: 'pantry', beverages: 'pantry', other: 'pantry',
};
const DEFAULT_SHELF: Record<AisleId, number> = {
  produce: 7, meat: 2, seafood: 2, dairy: 14, bakery: 5, frozen: 180, canned: 730, 'pasta-grains': 365,
  baking: 365, spices: 730, 'oils-condiments': 365, international: 365, snacks: 180, beverages: 365, other: 30,
};

type Opts = Partial<Omit<Ingredient, 'id' | 'name' | 'aisle' | 'baseUnit' | 'source'>>;

function I(id: string, name: string, aisle: AisleId, baseUnit: Ingredient['baseUnit'], o: Opts = {}): Ingredient {
  const defaultLocation = o.defaultLocation ?? DEFAULT_LOCATION[aisle];
  return {
    id, name, aisle, baseUnit,
    aliases: [], packages: [],
    shelfLife: { [defaultLocation]: DEFAULT_SHELF[aisle] },
    trackMode: 'exact', keepStocked: false, valueWeight: 1,
    ...o,
    defaultLocation,
    source: 'builtin',
  };
}

const meat = (id: string, name: string, o: Opts) =>
  I(id, name, 'meat', 'g', { valueWeight: 3, shelfLife: { fridge: 2, freezer: 120 }, ...o });

const spice = (id: string, name: string, density: number, aliases: string[] = [], o: Opts = {}) =>
  I(id, name, 'spices', 'g', { density, aliases, trackMode: 'loose', packages: [{ label: 'jar', qty: 50 }], shelfLife: { pantry: 730 }, ...o });

const looseLiquid = (id: string, name: string, aisle: AisleId, density: number, pkg: string, ml: number, o: Opts = {}) =>
  I(id, name, aisle, 'ml', { density, trackMode: 'loose', packages: [{ label: pkg, qty: ml }], shelfLife: { pantry: 365 }, ...o });

const can = (id: string, name: string, grams: number, o: Opts = {}) =>
  I(id, name, 'canned', 'ea', { gramsPerEach: grams, unitAliases: { can: 1 }, displayUnit: 'can', shelfLife: { pantry: 730 }, ...o });

export const INGREDIENTS: Ingredient[] = [
  // ---------- Produce ----------
  I('yellow-onion', 'Yellow onion', 'produce', 'ea', { aliases: ['onion', 'white onion', 'brown onion', 'sweet onion'], gramsPerEach: 150, density: 0.68, defaultLocation: 'pantry', shelfLife: { pantry: 30 } }),
  I('red-onion', 'Red onion', 'produce', 'ea', { aliases: ['purple onion'], gramsPerEach: 150, density: 0.68, defaultLocation: 'pantry', shelfLife: { pantry: 30 } }),
  I('shallot', 'Shallot', 'produce', 'ea', { gramsPerEach: 45, density: 0.68, defaultLocation: 'pantry', shelfLife: { pantry: 30 } }),
  I('garlic', 'Garlic', 'produce', 'g', { aliases: ['garlic clove', 'cloves garlic', 'garlic cloves'], unitAliases: { clove: 5, head: 50 }, displayUnit: 'clove', density: 0.6, packages: [{ label: 'head', qty: 50 }], defaultLocation: 'pantry', shelfLife: { pantry: 60 } }),
  I('green-onion', 'Green onions', 'produce', 'ea', { aliases: ['scallion', 'scallions', 'green onion', 'spring onions'], gramsPerEach: 15, density: 0.42, unitAliases: { bunch: 8, stalk: 1 }, packages: [{ label: 'bunch', qty: 8 }], shelfLife: { fridge: 10 } }),
  I('ginger', 'Fresh ginger', 'produce', 'g', { aliases: ['ginger', 'ginger root'], density: 0.4, unitAliases: { inch: 10, knob: 60 }, packages: [{ label: 'knob (~2 oz)', qty: 60 }], shelfLife: { fridge: 21 } }),
  I('carrot', 'Carrots', 'produce', 'ea', { aliases: ['carrot'], gramsPerEach: 70, density: 0.54, packages: [{ label: '1 lb bag', qty: 6 }], shelfLife: { fridge: 28 } }),
  I('celery', 'Celery', 'produce', 'ea', { aliases: ['celery stalks', 'celery ribs'], gramsPerEach: 40, density: 0.43, unitAliases: { stalk: 1, rib: 1 }, displayUnit: 'stalk', packages: [{ label: 'bunch', qty: 9 }], shelfLife: { fridge: 21 } }),
  I('bell-pepper', 'Bell pepper', 'produce', 'ea', { aliases: ['red bell pepper', 'green bell pepper', 'yellow bell pepper', 'orange bell pepper', 'bell peppers'], gramsPerEach: 160, density: 0.63, shelfLife: { fridge: 10 } }),
  I('jalapeno', 'Jalapeño', 'produce', 'ea', { aliases: ['jalapeno pepper', 'jalapeño pepper'], gramsPerEach: 20, shelfLife: { fridge: 10 } }),
  I('broccoli', 'Broccoli', 'produce', 'g', { aliases: ['broccoli florets', 'broccoli crowns'], density: 0.38, unitAliases: { crown: 340, head: 450 }, packages: [{ label: 'crown (~12 oz)', qty: 340 }], shelfLife: { fridge: 7 } }),
  I('asparagus', 'Asparagus', 'produce', 'g', { density: 0.57, unitAliases: { bunch: 450 }, packages: [{ label: 'bunch (~1 lb)', qty: 450 }], shelfLife: { fridge: 5 } }),
  I('green-beans', 'Green beans', 'produce', 'g', { aliases: ['string beans', 'haricots verts'], density: 0.46, packages: [{ label: '12 oz bag', qty: oz(12) }, { label: '1 lb bag', qty: lb(1) }], shelfLife: { fridge: 7 } }),
  I('zucchini', 'Zucchini', 'produce', 'ea', { gramsPerEach: 200, density: 0.53, shelfLife: { fridge: 7 } }),
  I('mushrooms', 'Mushrooms', 'produce', 'g', { aliases: ['cremini mushrooms', 'baby bella mushrooms', 'white mushrooms', 'mushroom'], density: 0.3, packages: [{ label: '8 oz pack', qty: oz(8) }], shelfLife: { fridge: 7 } }),
  I('spinach', 'Baby spinach', 'produce', 'g', { aliases: ['spinach', 'fresh spinach'], density: 0.127, packages: [{ label: '5 oz bag', qty: oz(5) }, { label: '10 oz bag', qty: oz(10) }], shelfLife: { fridge: 5 } }),
  I('romaine-hearts', 'Romaine hearts', 'produce', 'ea', { aliases: ['romaine', 'romaine lettuce', 'lettuce', 'romaine heart'], gramsPerEach: 280, density: 0.2, unitAliases: { heart: 1, head: 1 }, packages: [{ label: '3-pack', qty: 3 }], shelfLife: { fridge: 10 } }),
  I('cherry-tomatoes', 'Cherry tomatoes', 'produce', 'g', { aliases: ['grape tomatoes'], density: 0.63, packages: [{ label: '10 oz pint', qty: oz(10) }], shelfLife: { fridge: 7 } }),
  I('tomato', 'Tomatoes', 'produce', 'ea', { aliases: ['tomato', 'roma tomatoes', 'roma tomato'], gramsPerEach: 180, density: 0.76, defaultLocation: 'pantry', shelfLife: { pantry: 5, fridge: 10 } }),
  I('cucumber', 'Cucumber', 'produce', 'ea', { aliases: ['english cucumber'], gramsPerEach: 300, density: 0.56, shelfLife: { fridge: 7 } }),
  I('avocado', 'Avocado', 'produce', 'ea', { aliases: ['avocados'], gramsPerEach: 170, defaultLocation: 'pantry', shelfLife: { pantry: 4, fridge: 7 } }),
  I('lemon', 'Lemons', 'produce', 'ea', { aliases: ['lemon', 'lemon juice'], gramsPerEach: 100, shelfLife: { fridge: 21 } }),
  I('lime', 'Limes', 'produce', 'ea', { aliases: ['lime', 'lime juice'], gramsPerEach: 67, shelfLife: { fridge: 21 } }),
  I('cilantro', 'Cilantro', 'produce', 'g', { aliases: ['fresh cilantro', 'coriander leaves'], density: 0.07, unitAliases: { bunch: 60 }, packages: [{ label: 'bunch', qty: 60 }], shelfLife: { fridge: 7 } }),
  I('parsley', 'Parsley', 'produce', 'g', { aliases: ['fresh parsley', 'flat-leaf parsley', 'italian parsley'], density: 0.064, unitAliases: { bunch: 60 }, packages: [{ label: 'bunch', qty: 60 }], shelfLife: { fridge: 7 } }),
  I('basil', 'Fresh basil', 'produce', 'g', { aliases: ['basil', 'basil leaves'], density: 0.09, unitAliases: { bunch: 30 }, packages: [{ label: '0.75 oz pack', qty: 21 }], shelfLife: { fridge: 5 } }),
  I('potato', 'Potatoes', 'produce', 'g', { aliases: ['potato', 'yukon gold potatoes', 'baby potatoes', 'russet potatoes', 'red potatoes'], gramsPerEach: 200, density: 0.64, packages: [{ label: '3 lb bag', qty: lb(3) }, { label: '5 lb bag', qty: lb(5) }], defaultLocation: 'pantry', shelfLife: { pantry: 30 } }),
  I('sweet-potato', 'Sweet potatoes', 'produce', 'g', { aliases: ['sweet potato', 'yams'], gramsPerEach: 250, density: 0.56, defaultLocation: 'pantry', shelfLife: { pantry: 21 } }),
  I('apple', 'Apples', 'produce', 'ea', { aliases: ['apple', 'honeycrisp apple', 'granny smith apple'], gramsPerEach: 180, shelfLife: { fridge: 30 } }),
  I('banana', 'Bananas', 'produce', 'ea', { aliases: ['banana'], gramsPerEach: 120, defaultLocation: 'pantry', shelfLife: { pantry: 5 } }),
  I('orange', 'Oranges', 'produce', 'ea', { aliases: ['orange'], gramsPerEach: 140, shelfLife: { fridge: 21 } }),
  I('strawberries', 'Strawberries', 'produce', 'g', { aliases: ['strawberry'], density: 0.6, packages: [{ label: '1 lb clamshell', qty: lb(1) }], shelfLife: { fridge: 5 } }),
  I('blueberries', 'Blueberries', 'produce', 'g', { aliases: ['blueberry'], density: 0.62, packages: [{ label: '6 oz container', qty: oz(6) }], shelfLife: { fridge: 7 } }),

  // ---------- Meat & seafood ----------
  meat('ground-beef', 'Ground beef', { aliases: ['lean ground beef', '80/20 ground beef', 'hamburger meat', 'beef mince'], packages: [{ label: '1 lb pack', qty: lb(1) }, { label: '2 lb pack', qty: lb(2) }] }),
  meat('ground-turkey', 'Ground turkey', { aliases: ['turkey mince', 'lean ground turkey'], packages: [{ label: '1 lb pack', qty: lb(1) }] }),
  meat('chicken-breast', 'Chicken breasts', { aliases: ['chicken breast', 'boneless skinless chicken breast', 'boneless skinless chicken breasts'], gramsPerEach: 225, packages: [{ label: '1.5 lb pack', qty: lb(1.5) }, { label: '3 lb pack', qty: lb(3) }] }),
  meat('chicken-thighs', 'Chicken thighs (boneless)', { aliases: ['chicken thighs', 'boneless skinless chicken thighs', 'chicken thigh'], gramsPerEach: 115, packages: [{ label: '1.5 lb pack', qty: lb(1.5) }, { label: '3 lb pack', qty: lb(3) }] }),
  meat('sirloin-steak', 'Sirloin steak', { aliases: ['sirloin', 'top sirloin', 'flank steak', 'steak'], packages: [{ label: '1 lb pack', qty: lb(1) }, { label: '1.5 lb pack', qty: lb(1.5) }] }),
  meat('pork-chops', 'Pork chops (boneless)', { aliases: ['pork chops', 'boneless pork chops', 'pork chop'], gramsPerEach: 200, packages: [{ label: '4-pack (~1.75 lb)', qty: lb(1.75) }] }),
  meat('smoked-sausage', 'Smoked sausage', { aliases: ['kielbasa', 'polish sausage'], packages: [{ label: '14 oz rope', qty: oz(14) }], shelfLife: { fridge: 14, freezer: 60 } }),
  meat('bacon', 'Bacon', { unitAliases: { slice: 28 }, packages: [{ label: '12 oz pack', qty: oz(12) }], shelfLife: { fridge: 7, freezer: 90 } }),
  meat('deli-turkey', 'Deli turkey', { aliases: ['sliced turkey', 'turkey lunch meat'], packages: [{ label: '8 oz pack', qty: oz(8) }], shelfLife: { fridge: 5 } }),
  I('salmon', 'Salmon fillets', 'seafood', 'g', { aliases: ['salmon', 'salmon fillet'], gramsPerEach: 170, valueWeight: 3, shelfLife: { fridge: 2, freezer: 90 } }),
  I('shrimp', 'Shrimp (raw, peeled)', 'seafood', 'g', { aliases: ['shrimp', 'large shrimp', 'raw shrimp', 'prawns'], valueWeight: 3, packages: [{ label: '1 lb bag', qty: lb(1) }], defaultLocation: 'freezer', shelfLife: { freezer: 180, fridge: 2 } }),

  // ---------- Dairy & eggs ----------
  I('eggs', 'Eggs', 'dairy', 'ea', { aliases: ['egg', 'large eggs', 'large egg'], gramsPerEach: 50, unitAliases: { egg: 1 }, packages: [{ label: 'dozen', qty: 12 }, { label: '18-count', qty: 18 }], shelfLife: { fridge: 35 }, keepStocked: true }),
  I('butter', 'Butter', 'dairy', 'g', { aliases: ['unsalted butter', 'salted butter'], density: 0.96, unitAliases: { stick: 113 }, packages: [{ label: '1 lb (4 sticks)', qty: 454 }], shelfLife: { fridge: 90 }, keepStocked: true }),
  I('milk', 'Milk', 'dairy', 'ml', { aliases: ['whole milk', '2% milk'], density: 1.03, packages: [{ label: 'half gallon', qty: 1893 }, { label: 'gallon', qty: 3785 }], shelfLife: { fridge: 7 }, keepStocked: true }),
  I('heavy-cream', 'Heavy cream', 'dairy', 'ml', { aliases: ['heavy whipping cream', 'whipping cream', 'cream'], density: 1, packages: [{ label: '1 cup carton', qty: 237 }, { label: '1 pint carton', qty: 473 }], shelfLife: { fridge: 14 } }),
  I('sour-cream', 'Sour cream', 'dairy', 'g', { density: 0.96, packages: [{ label: '8 oz tub', qty: oz(8) }, { label: '16 oz tub', qty: oz(16) }], shelfLife: { fridge: 14 } }),
  I('greek-yogurt', 'Greek yogurt (plain)', 'dairy', 'g', { aliases: ['greek yogurt', 'plain greek yogurt', 'plain yogurt', 'yogurt'], density: 1.05, packages: [{ label: '5.3 oz cup', qty: 150 }, { label: '32 oz tub', qty: oz(32) }], shelfLife: { fridge: 14 } }),
  I('cream-cheese', 'Cream cheese', 'dairy', 'g', { density: 0.97, packages: [{ label: '8 oz block', qty: oz(8) }], shelfLife: { fridge: 21 }, valueWeight: 2 }),
  I('parmesan', 'Parmesan', 'dairy', 'g', { aliases: ['parmesan cheese', 'grated parmesan', 'parmigiano reggiano', 'parmigiano-reggiano'], density: 0.42, packages: [{ label: '5 oz tub', qty: oz(5) }, { label: '8 oz wedge', qty: oz(8) }], shelfLife: { fridge: 30 }, valueWeight: 2 }),
  I('mozzarella', 'Mozzarella (shredded)', 'dairy', 'g', { aliases: ['mozzarella', 'shredded mozzarella', 'mozzarella cheese'], density: 0.48, packages: [{ label: '8 oz bag', qty: oz(8) }, { label: '16 oz bag', qty: oz(16) }], shelfLife: { fridge: 14 }, valueWeight: 2 }),
  I('cheddar', 'Cheddar (shredded)', 'dairy', 'g', { aliases: ['cheddar', 'cheddar cheese', 'shredded cheddar', 'sharp cheddar'], density: 0.48, packages: [{ label: '8 oz bag', qty: oz(8) }], shelfLife: { fridge: 21 }, valueWeight: 2 }),
  I('mexican-cheese', 'Mexican blend cheese', 'dairy', 'g', { aliases: ['shredded mexican cheese', 'monterey jack', 'colby jack', 'mexican cheese'], density: 0.48, packages: [{ label: '8 oz bag', qty: oz(8) }], shelfLife: { fridge: 21 }, valueWeight: 2 }),
  I('feta', 'Feta', 'dairy', 'g', { aliases: ['feta cheese', 'crumbled feta'], density: 0.64, packages: [{ label: '6 oz crumbles', qty: oz(6) }], shelfLife: { fridge: 14 }, valueWeight: 2 }),
  I('ricotta', 'Ricotta', 'dairy', 'g', { aliases: ['ricotta cheese', 'whole milk ricotta'], density: 1.04, packages: [{ label: '15 oz tub', qty: oz(15) }], shelfLife: { fridge: 10 }, valueWeight: 2 }),
  I('cheese-slices', 'Cheese slices', 'dairy', 'ea', { aliases: ['american cheese', 'american cheese slices', 'sliced cheddar'], gramsPerEach: 21, unitAliases: { slice: 1 }, packages: [{ label: '16-slice pack', qty: 16 }], shelfLife: { fridge: 30 }, valueWeight: 2 }),
  I('orange-juice', 'Orange juice', 'beverages', 'ml', { aliases: ['oj'], density: 1.04, packages: [{ label: '52 oz bottle', qty: floz(52) }], defaultLocation: 'fridge', shelfLife: { fridge: 10 } }),

  // ---------- Bakery ----------
  I('flour-tortillas', 'Flour tortillas', 'bakery', 'ea', { aliases: ['tortillas', 'flour tortilla', 'burrito tortillas'], gramsPerEach: 45, unitAliases: { tortilla: 1 }, packages: [{ label: '10-count', qty: 10 }], shelfLife: { pantry: 14 } }),
  I('corn-tortillas', 'Corn tortillas', 'bakery', 'ea', { aliases: ['corn tortilla'], gramsPerEach: 25, unitAliases: { tortilla: 1 }, packages: [{ label: '30-count', qty: 30 }], shelfLife: { pantry: 14 } }),
  I('hamburger-buns', 'Hamburger buns', 'bakery', 'ea', { aliases: ['burger buns', 'buns'], gramsPerEach: 50, unitAliases: { bun: 1 }, packages: [{ label: '8-pack', qty: 8 }], shelfLife: { pantry: 6 } }),
  I('baguette', 'Baguette', 'bakery', 'ea', { aliases: ['french bread', 'crusty bread'], gramsPerEach: 250, shelfLife: { pantry: 2 } }),
  I('sandwich-bread', 'Sandwich bread', 'bakery', 'ea', { aliases: ['bread', 'white bread', 'wheat bread'], gramsPerEach: 28, unitAliases: { slice: 1, loaf: 20 }, packages: [{ label: 'loaf', qty: 20 }], shelfLife: { pantry: 7 } }),
  I('bagels', 'Bagels', 'bakery', 'ea', { aliases: ['bagel'], gramsPerEach: 100, packages: [{ label: '6-pack', qty: 6 }], shelfLife: { pantry: 5 } }),

  // ---------- Pasta, rice & grains ----------
  I('spaghetti', 'Spaghetti', 'pasta-grains', 'g', { packages: [{ label: '1 lb box', qty: lb(1) }] }),
  I('linguine', 'Linguine', 'pasta-grains', 'g', { aliases: ['fettuccine'], packages: [{ label: '1 lb box', qty: lb(1) }] }),
  I('penne', 'Penne', 'pasta-grains', 'g', { aliases: ['ziti', 'rigatoni', 'penne pasta'], packages: [{ label: '1 lb box', qty: lb(1) }] }),
  I('egg-noodles', 'Egg noodles', 'pasta-grains', 'g', { aliases: ['wide egg noodles'], density: 0.16, packages: [{ label: '12 oz bag', qty: oz(12) }] }),
  I('rice-noodles', 'Rice noodles', 'international', 'g', { aliases: ['pad thai noodles', 'rice stick noodles'], packages: [{ label: '14 oz pack', qty: oz(14) }], shelfLife: { pantry: 365 } }),
  I('white-rice', 'White rice', 'pasta-grains', 'g', { aliases: ['rice', 'long-grain white rice', 'long grain rice', 'jasmine rice', 'basmati rice'], density: 0.78, packages: [{ label: '2 lb bag', qty: lb(2) }, { label: '5 lb bag', qty: lb(5) }], keepStocked: true }),
  I('arborio-rice', 'Arborio rice', 'pasta-grains', 'g', { aliases: ['arborio', 'risotto rice'], density: 0.85, packages: [{ label: '1 lb bag', qty: lb(1) }] }),
  I('quinoa', 'Quinoa', 'pasta-grains', 'g', { density: 0.72, packages: [{ label: '12 oz bag', qty: oz(12) }] }),
  I('rolled-oats', 'Rolled oats', 'pasta-grains', 'g', { aliases: ['old-fashioned oats', 'old fashioned oats', 'oats'], density: 0.34, packages: [{ label: '18 oz canister', qty: oz(18) }] }),

  // ---------- Canned & jarred ----------
  can('black-beans', 'Black beans', 425, { aliases: ['canned black beans'] }),
  can('chickpeas', 'Chickpeas', 425, { aliases: ['garbanzo beans', 'canned chickpeas'] }),
  can('kidney-beans', 'Kidney beans', 425, { aliases: ['red kidney beans'] }),
  can('crushed-tomatoes', 'Crushed tomatoes (28 oz)', 794, { aliases: ['crushed tomatoes', 'canned crushed tomatoes'], density: 1.07 }),
  can('diced-tomatoes', 'Diced tomatoes (14.5 oz)', 411, { aliases: ['diced tomatoes', 'canned diced tomatoes'], density: 1.03 }),
  can('tuna', 'Tuna', 142, { aliases: ['canned tuna'] }),
  I('tomato-paste', 'Tomato paste', 'canned', 'g', { density: 1.1, unitAliases: { can: 170 }, packages: [{ label: '6 oz can', qty: 170 }], shelfLife: { pantry: 730 } }),
  I('marinara', 'Marinara sauce', 'canned', 'g', { aliases: ['marinara', 'pasta sauce', 'spaghetti sauce'], density: 1.05, unitAliases: { jar: 680 }, packages: [{ label: '24 oz jar', qty: 680 }], shelfLife: { pantry: 365 } }),
  I('coconut-milk', 'Coconut milk', 'international', 'ea', { aliases: ['canned coconut milk', 'full-fat coconut milk'], gramsPerEach: 400, density: 0.97, unitAliases: { can: 1 }, displayUnit: 'can', shelfLife: { pantry: 730 } }),
  I('chicken-broth', 'Chicken broth', 'canned', 'ml', { aliases: ['chicken stock', 'low-sodium chicken broth'], density: 1, packages: [{ label: '32 oz carton', qty: 946 }], shelfLife: { pantry: 365 } }),
  I('beef-broth', 'Beef broth', 'canned', 'ml', { aliases: ['beef stock'], density: 1, packages: [{ label: '32 oz carton', qty: 946 }], shelfLife: { pantry: 365 } }),
  I('vegetable-broth', 'Vegetable broth', 'canned', 'ml', { aliases: ['vegetable stock', 'veggie broth'], density: 1, packages: [{ label: '32 oz carton', qty: 946 }], shelfLife: { pantry: 365 } }),
  I('enchilada-sauce', 'Red enchilada sauce (10 oz)', 'international', 'ea', { aliases: ['enchilada sauce'], gramsPerEach: 283, density: 1.05, unitAliases: { can: 1 }, displayUnit: 'can', shelfLife: { pantry: 730 } }),
  I('salsa', 'Salsa', 'international', 'g', { aliases: ['jarred salsa'], density: 1.05, packages: [{ label: '16 oz jar', qty: oz(16) }], shelfLife: { pantry: 365 } }),
  I('sun-dried-tomatoes', 'Sun-dried tomatoes', 'canned', 'g', { aliases: ['sun dried tomatoes', 'oil-packed sun-dried tomatoes'], density: 0.46, packages: [{ label: '8.5 oz jar', qty: 241 }], shelfLife: { pantry: 365 } }),
  I('kalamata-olives', 'Kalamata olives', 'canned', 'g', { aliases: ['olives', 'kalamata'], density: 0.6, packages: [{ label: '6 oz jar', qty: 170 }], shelfLife: { pantry: 365 } }),
  I('dill-pickles', 'Dill pickles', 'oils-condiments', 'g', { aliases: ['pickles', 'pickle chips', 'dill pickle'], density: 0.7, unitAliases: { slice: 7 }, packages: [{ label: '24 oz jar', qty: 680 }], defaultLocation: 'fridge', shelfLife: { fridge: 90 } }),
  I('peanuts', 'Roasted peanuts', 'snacks', 'g', { aliases: ['peanuts', 'dry roasted peanuts'], density: 0.6, packages: [{ label: '16 oz jar', qty: lb(1) }], shelfLife: { pantry: 180 } }),
  I('peanut-butter', 'Peanut butter', 'snacks', 'g', { density: 1.08, trackMode: 'loose', packages: [{ label: '16 oz jar', qty: lb(1) }], shelfLife: { pantry: 180 } }),

  // ---------- Frozen ----------
  I('frozen-peas', 'Frozen peas', 'frozen', 'g', { aliases: ['peas', 'green peas'], density: 0.6, packages: [{ label: '12 oz bag', qty: oz(12) }], shelfLife: { freezer: 240 } }),
  I('frozen-broccoli', 'Frozen broccoli', 'frozen', 'g', { density: 0.38, packages: [{ label: '12 oz bag', qty: oz(12) }], shelfLife: { freezer: 240 } }),

  // ---------- Baking ----------
  I('all-purpose-flour', 'All-purpose flour', 'baking', 'g', { aliases: ['flour', 'ap flour'], density: 0.53, trackMode: 'loose', keepStocked: true, packages: [{ label: '5 lb bag', qty: lb(5) }] }),
  I('sugar', 'Sugar', 'baking', 'g', { aliases: ['granulated sugar', 'white sugar'], density: 0.85, trackMode: 'loose', keepStocked: true, packages: [{ label: '4 lb bag', qty: lb(4) }] }),
  I('brown-sugar', 'Brown sugar', 'baking', 'g', { aliases: ['light brown sugar', 'dark brown sugar', 'packed brown sugar'], density: 0.93, trackMode: 'loose', packages: [{ label: '2 lb bag', qty: lb(2) }] }),
  I('baking-powder', 'Baking powder', 'baking', 'g', { density: 0.9, trackMode: 'loose', packages: [{ label: '8 oz can', qty: oz(8) }] }),
  I('baking-soda', 'Baking soda', 'baking', 'g', { density: 1.1, trackMode: 'loose', packages: [{ label: '1 lb box', qty: lb(1) }] }),
  I('cornstarch', 'Cornstarch', 'baking', 'g', { aliases: ['corn starch', 'cornflour'], density: 0.54, trackMode: 'loose', packages: [{ label: '16 oz box', qty: lb(1) }] }),
  looseLiquid('vanilla-extract', 'Vanilla extract', 'baking', 0.88, '2 oz bottle', floz(2), { aliases: ['vanilla', 'pure vanilla extract'] }),
  I('panko', 'Panko breadcrumbs', 'baking', 'g', { aliases: ['panko', 'breadcrumbs', 'bread crumbs'], density: 0.25, packages: [{ label: '8 oz box', qty: oz(8) }], shelfLife: { pantry: 180 } }),
  I('chia-seeds', 'Chia seeds', 'baking', 'g', { aliases: ['chia'], density: 0.65, trackMode: 'loose', packages: [{ label: '12 oz bag', qty: oz(12) }] }),
  looseLiquid('honey', 'Honey', 'oils-condiments', 1.42, '12 oz bottle', 240),
  looseLiquid('maple-syrup', 'Maple syrup', 'oils-condiments', 1.32, '12 oz bottle', floz(12), { aliases: ['pure maple syrup', 'syrup'] }),

  // ---------- Oils, vinegars & condiments ----------
  looseLiquid('olive-oil', 'Olive oil', 'oils-condiments', 0.91, '500 ml bottle', 500, { aliases: ['extra virgin olive oil', 'extra-virgin olive oil', 'evoo'], keepStocked: true }),
  looseLiquid('vegetable-oil', 'Vegetable oil', 'oils-condiments', 0.92, '48 oz bottle', floz(48), { aliases: ['canola oil', 'neutral oil', 'cooking oil', 'avocado oil'], keepStocked: true }),
  looseLiquid('sesame-oil', 'Toasted sesame oil', 'international', 0.92, '5 oz bottle', floz(5), { aliases: ['sesame oil'] }),
  looseLiquid('soy-sauce', 'Soy sauce', 'international', 1.2, '15 oz bottle', floz(15), { aliases: ['low-sodium soy sauce', 'tamari', 'shoyu'] }),
  looseLiquid('fish-sauce', 'Fish sauce', 'international', 1.2, '6.7 oz bottle', 200),
  looseLiquid('rice-vinegar', 'Rice vinegar', 'international', 1.01, '12 oz bottle', floz(12), { aliases: ['rice wine vinegar', 'seasoned rice vinegar'] }),
  looseLiquid('red-wine-vinegar', 'Red wine vinegar', 'oils-condiments', 1.01, '16 oz bottle', floz(16)),
  looseLiquid('worcestershire', 'Worcestershire sauce', 'oils-condiments', 1.1, '10 oz bottle', floz(10), { aliases: ['worcestershire'] }),
  looseLiquid('sriracha', 'Sriracha', 'international', 1.1, '17 oz bottle', 500, { aliases: ['hot sauce', 'chili garlic sauce'] }),
  I('dijon-mustard', 'Dijon mustard', 'oils-condiments', 'g', { aliases: ['dijon', 'mustard'], density: 1, trackMode: 'loose', packages: [{ label: '8 oz jar', qty: oz(8) }], defaultLocation: 'fridge', shelfLife: { fridge: 180 } }),
  I('mayonnaise', 'Mayonnaise', 'oils-condiments', 'g', { aliases: ['mayo'], density: 0.92, trackMode: 'loose', packages: [{ label: '30 oz jar', qty: oz(30) }], defaultLocation: 'fridge', shelfLife: { fridge: 60 } }),
  I('ketchup', 'Ketchup', 'oils-condiments', 'g', { density: 1.15, trackMode: 'loose', packages: [{ label: '32 oz bottle', qty: oz(32) }], defaultLocation: 'fridge', shelfLife: { fridge: 180 } }),
  I('dry-white-wine', 'Dry white wine', 'beverages', 'ml', { aliases: ['white wine', 'sauvignon blanc', 'pinot grigio'], density: 0.99, packages: [{ label: '750 ml bottle', qty: 750 }], shelfLife: { pantry: 365 } }),
  I('coffee', 'Coffee', 'beverages', 'g', { aliases: ['ground coffee', 'coffee beans'], density: 0.4, trackMode: 'loose', packages: [{ label: '12 oz bag', qty: oz(12) }], shelfLife: { pantry: 90 } }),

  // ---------- Spices ----------
  spice('salt', 'Salt', 1.2, ['kosher salt', 'sea salt', 'table salt'], { keepStocked: true, packages: [{ label: '26 oz canister', qty: oz(26) }] }),
  spice('black-pepper', 'Black pepper', 0.46, ['pepper', 'ground black pepper', 'freshly ground black pepper'], { keepStocked: true }),
  spice('chili-powder', 'Chili powder', 0.54),
  spice('ground-cumin', 'Ground cumin', 0.48, ['cumin']),
  spice('paprika', 'Paprika', 0.46, ['sweet paprika']),
  spice('smoked-paprika', 'Smoked paprika', 0.46),
  spice('garlic-powder', 'Garlic powder', 0.65, ['granulated garlic']),
  spice('onion-powder', 'Onion powder', 0.5),
  spice('dried-oregano', 'Dried oregano', 0.2, ['oregano']),
  spice('italian-seasoning', 'Italian seasoning', 0.25),
  spice('red-pepper-flakes', 'Red pepper flakes', 0.36, ['crushed red pepper', 'chili flakes']),
  spice('ground-cinnamon', 'Ground cinnamon', 0.53, ['cinnamon']),
  spice('garam-masala', 'Garam masala', 0.4),
  spice('ground-turmeric', 'Ground turmeric', 0.63, ['turmeric']),
  spice('ground-coriander', 'Ground coriander', 0.4, ['coriander']),
  spice('curry-powder', 'Curry powder', 0.42, ['yellow curry powder']),
  spice('cayenne', 'Cayenne pepper', 0.36, ['cayenne', 'ground cayenne']),
  spice('dried-thyme', 'Dried thyme', 0.28, ['thyme']),
  spice('bay-leaves', 'Bay leaves', 0.05, ['bay leaf'], { unitAliases: { leaf: 0.2 }, packages: [{ label: 'jar', qty: 5 }] }),
];
