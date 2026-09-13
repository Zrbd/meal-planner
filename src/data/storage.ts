// Storage know-how: how to make ingredients last longer, and how to thaw them safely.
// `days` = realistic shelf life when the tip is followed. `shelfLife` overrides the catalog's baseline
// (the baseline assumes ordinary storage, e.g. green onions tossed in the crisper).
import type { Ingredient, Location } from '../domain/types';

interface StorageInfo {
  tip?: string;
  days?: Partial<Record<Location, number>>;
  shelfLife?: Partial<Record<Location, number>>;
  thaw?: string;
}

const HERB_JAR =
  'Trim the stems, stand the bunch in a jar with an inch of water like flowers, and loosely cover the leaves with a produce bag. Keep it in the fridge and change the water every 2–3 days.';
const MEAT_FREEZE =
  "If you won't cook it within 2 days, freeze it right away — portion into zip-top bags, press out the air, flatten, and write the date on the bag.";
const MEAT_THAW =
  'Thaw overnight in the fridge on a plate (about 24 hours per 2 lb). Short on time: seal it in a zip-top bag and submerge in cold water, changing the water every 30 minutes (~1 hour per lb). Never thaw on the counter.';
const CHEESE_WRAP = 'Wrap in parchment or wax paper, then loosely in a zip-top bag so it can breathe without drying out.';
const SHREDDED_CHEESE = 'Squeeze the air out and reseal the bag tightly. Shredded cheese freezes well for cooking — use it straight from frozen.';
const BREAD_FREEZE = "Freeze what you won't eat in a few days. Separate slices/pieces first so you can pull out just what you need and toast or warm from frozen.";
const CLEAN_SPOON = 'Always use a clean spoon — bits of food introduced into the tub are what make it spoil early.';

export const STORAGE: Record<string, StorageInfo> = {
  // ---------- Produce ----------
  'green-onion': {
    tip: `Don't leave them loose in the crisper — they wilt in a day or two. Stand them roots-down in a glass with an inch of water, loosely cover the tops with a bag, and keep them in the fridge (change the water every couple of days). No jar? Wrap them in a damp paper towel inside a zip-top bag. Extra slices freeze well in a bag and go straight into cooked dishes.`,
    shelfLife: { fridge: 4 },
    days: { fridge: 14 },
  },
  cilantro: { tip: `${HERB_JAR} Don't wash it until you use it.`, shelfLife: { fridge: 5 }, days: { fridge: 14 } },
  parsley: { tip: `${HERB_JAR} Chopped extra parsley can be frozen in an ice cube tray with a little olive oil.`, shelfLife: { fridge: 6 }, days: { fridge: 21 } },
  basil: {
    tip: 'Basil turns black in the cold. Keep it on the counter out of direct sun, stems in a jar of water with a bag loosely over the top. Leftover leaves can be blended with olive oil and frozen in ice cube trays.',
    shelfLife: { fridge: 3, pantry: 4 },
    days: { pantry: 7 },
  },
  spinach: {
    tip: 'Tuck a dry paper towel into the box or bag to soak up moisture, and pick out any slimy leaves as soon as you see them — they spoil the rest. Wilting spinach is still perfect for cooking.',
    days: { fridge: 10 },
  },
  'romaine-hearts': {
    tip: "Wrap unwashed heads in a dry paper towel and keep them in a bag in the crisper. Limp leaves perk back up after 10 minutes in ice water.",
    days: { fridge: 14 },
  },
  mushrooms: {
    tip: "Keep them in a paper bag (or the original box with the plastic poked open) — sealed plastic makes them slimy. Don't rinse until right before cooking.",
    shelfLife: { fridge: 5 },
    days: { fridge: 10 },
  },
  celery: {
    tip: 'Wrap the whole bunch tightly in aluminum foil instead of plastic; it stays crisp for weeks. Limp stalks revive in a glass of ice water.',
    days: { fridge: 35 },
  },
  carrot: {
    tip: 'Cut off any green tops (they pull moisture from the carrot). Store in a bag with a paper towel, or peeled sticks submerged in water in a container.',
    days: { fridge: 35 },
  },
  asparagus: {
    tip: 'Trim the ends and stand the spears in a jar with an inch of water, loosely covered with a bag, in the fridge.',
    shelfLife: { fridge: 4 },
    days: { fridge: 8 },
  },
  broccoli: { tip: 'Keep it unwashed in an open or perforated bag, loosely wrapped in a damp paper towel so it doesn\'t go rubbery.', days: { fridge: 10 } },
  'bell-pepper': { tip: 'Store whole and dry in the crisper. Once cut, keep pieces in a container lined with a paper towel. Diced peppers freeze well for cooking.', days: { fridge: 14 } },
  jalapeno: { tip: 'Keep whole peppers in a paper bag in the crisper. They also freeze whole — slice them while still frozen.', days: { fridge: 14, freezer: 180 } },
  'green-beans': { tip: 'Store unwashed in a loosely closed bag. Rinse and trim only right before cooking.', days: { fridge: 10 } },
  zucchini: { tip: 'Keep dry and unwashed in a partly open bag in the crisper — moisture on the skin causes soft spots.', days: { fridge: 10 } },
  cucumber: {
    tip: 'Wrap in a paper towel and keep it toward the front of the fridge (the back is too cold). Keep it away from bananas, apples, and tomatoes, which speed up spoiling.',
    days: { fridge: 10 },
  },
  'cherry-tomatoes': { tip: 'Keep them on the counter, unwashed, for the best flavor. Only move them to the fridge once they are fully ripe and you need a few extra days.', shelfLife: { fridge: 7, pantry: 5 }, days: { fridge: 10 } },
  tomato: { tip: 'Ripen on the counter stem-side down, out of the sun. Refrigerate only once very ripe; let them come back to room temperature before eating.', days: { fridge: 12 } },
  avocado: {
    tip: 'Ripen on the counter (in a paper bag with a banana to speed it up). Once ripe, move to the fridge to buy about 5 more days. For a cut half, leave the pit in, brush with lime or lemon juice, and press plastic wrap onto the surface.',
    days: { fridge: 9 },
  },
  lemon: { tip: 'Sealed in a zip-top bag in the fridge, lemons stay juicy for about a month (vs. a week on the counter). Zest before juicing and freeze the zest.', days: { fridge: 30 } },
  lime: { tip: 'Sealed in a zip-top bag in the fridge, limes stay juicy for about a month (vs. a week on the counter).', days: { fridge: 30 } },
  ginger: { tip: 'Freeze the whole unpeeled root in a bag. Grate it straight from frozen with a microplane — no peeling needed, and it lasts months.', days: { freezer: 180 } },
  garlic: { tip: 'Keep whole heads in a cool, dark, airy spot (not the fridge, not in plastic). Once you break the head, use the cloves within about 10 days.', days: { pantry: 90 } },
  'yellow-onion': { tip: 'Store whole onions somewhere cool, dark, and airy — but not next to potatoes; they make each other spoil faster. Cut onion keeps 7 days in a sealed container in the fridge.', days: { pantry: 60 } },
  'red-onion': { tip: 'Store whole onions somewhere cool, dark, and airy, away from potatoes. Cut onion keeps 7 days in a sealed container in the fridge.', days: { pantry: 60 } },
  shallot: { tip: 'Keep in a cool, dark, airy spot, away from potatoes.', days: { pantry: 45 } },
  potato: { tip: 'Keep in a cool, dark place in a paper bag or basket — light turns them green and the fridge makes them gritty. Keep away from onions.', days: { pantry: 60 } },
  'sweet-potato': { tip: 'Store in a cool, dark, dry place (not the fridge). Use soft or sprouting ones first.', days: { pantry: 30 } },
  apple: { tip: 'Keep in the crisper drawer, away from other produce — apples give off gas that ripens everything around them.', days: { fridge: 45 } },
  banana: {
    tip: 'Keep away from other fruit and separate them from the bunch to slow ripening. Once they get spotty, peel, break into chunks, and freeze for smoothies or banana bread.',
    days: { freezer: 90 },
  },
  orange: { tip: 'Loose in the crisper drawer (not sealed) keeps them juicy for weeks.', days: { fridge: 30 } },
  strawberries: {
    tip: "Don't wash until you eat them. For longer life, rinse in 1 part vinegar to 3 parts water, dry completely, and store in a container lined with paper towels. Freeze any that get soft for smoothies.",
    shelfLife: { fridge: 4 },
    days: { fridge: 8 },
  },
  blueberries: {
    tip: "Keep them dry and unwashed in a container lined with a paper towel. A quick vinegar-water rinse (1:3), dried completely, keeps them even longer. They freeze perfectly spread on a tray.",
    days: { fridge: 14 },
  },

  // ---------- Meat & seafood ----------
  'ground-turkey': { tip: MEAT_FREEZE, days: { freezer: 120 }, thaw: MEAT_THAW },
  'chicken-breast': { tip: MEAT_FREEZE, days: { freezer: 270 }, thaw: MEAT_THAW },
  'chicken-thighs': { tip: MEAT_FREEZE, days: { freezer: 270 }, thaw: MEAT_THAW },
  'pork-chops': { tip: MEAT_FREEZE, days: { freezer: 180 }, thaw: MEAT_THAW },
  'smoked-sausage': { tip: 'Once opened, wrap tightly and use within a week, or slice and freeze.', thaw: 'Thaw overnight in the fridge, or slice from frozen and cook straight away.' },
  bacon: { tip: 'Freeze strips in portions of 3–4 rolled up in parchment so you can grab just what you need.', thaw: 'Bacon cooks fine from frozen over medium-low heat; separate strips as they soften.' },
  'deli-turkey': { tip: 'Once opened, keep sealed and use within 3–5 days. It freezes okay for cooked dishes.' },
  salmon: {
    tip: 'Keep it in the coldest part of the fridge (the back of the bottom shelf) and cook within 2 days, or freeze it tightly wrapped.',
    days: { freezer: 90 },
    thaw: 'Thaw overnight in the fridge. Quick: keep it sealed and submerge in cold water for about 30–60 minutes.',
  },
  shrimp: {
    tip: 'Keep frozen until the day you cook it — it thaws in minutes.',
    thaw: 'Put frozen shrimp in a colander and run cold water over them for 5–10 minutes, tossing occasionally, or thaw overnight in the fridge. Pat dry before cooking.',
  },

  // ---------- Dairy & eggs ----------
  eggs: { tip: 'Keep them in the carton on a shelf, not in the door — the door warms up every time the fridge opens.' },
  milk: { tip: 'Store on a back shelf rather than the door, where it stays coldest. Put it away as soon as you get home.' },
  'heavy-cream': { tip: 'Keep it on a back shelf. Leftover cream freezes in ice cube trays — drop a cube or two into soups and pan sauces.', days: { freezer: 90 } },
  'sour-cream': { tip: CLEAN_SPOON },
  'greek-yogurt': { tip: CLEAN_SPOON },
  'cream-cheese': { tip: `${CLEAN_SPOON} Opened blocks keep best wrapped tightly in plastic.` },
  ricotta: { tip: `${CLEAN_SPOON} Leftover ricotta freezes okay for baked dishes like lasagna.` },
  butter: { tip: 'Keep one stick handy and the rest in the freezer; butter freezes for months with no change.', days: { freezer: 180 } },
  parmesan: { tip: CHEESE_WRAP, days: { fridge: 60 } },
  cheddar: { tip: SHREDDED_CHEESE, days: { freezer: 90 } },
  mozzarella: { tip: SHREDDED_CHEESE, days: { freezer: 90 } },
  'mexican-cheese': { tip: SHREDDED_CHEESE, days: { freezer: 90 } },
  feta: { tip: 'If it came in brine, keep it submerged. Crumbles or blocks without brine keep longer covered in lightly salted water in a sealed container.', days: { fridge: 21 } },
  'orange-juice': { tip: 'Once opened, keep on a back shelf, tightly capped.' },

  // ---------- Bakery ----------
  'flour-tortillas': { tip: 'Refrigerate after opening to double their life, or freeze with parchment between them.', days: { fridge: 30 } },
  'corn-tortillas': { tip: 'Refrigerate after opening, or freeze in stacks of 6–8. Warm on a dry skillet to bring them back to life.', days: { fridge: 30 } },
  'hamburger-buns': { tip: BREAD_FREEZE, days: { freezer: 90 } },
  baguette: { tip: 'Cut into chunks and freeze the same day. Revive in a 350°F oven for 8–10 minutes.', days: { freezer: 90 } },
  'sandwich-bread': { tip: BREAD_FREEZE, days: { freezer: 90 } },
  bagels: { tip: 'Slice before freezing so you can toast straight from the freezer.', days: { freezer: 90 } },

  // ---------- Pantry ----------
  'brown-sugar': { tip: 'Keep in an airtight container with a slice of bread or a piece of terracotta to keep it soft.' },
  'all-purpose-flour': { tip: 'Store airtight in a cool, dry spot to keep bugs out.' },
  'tomato-paste': { tip: 'Freeze leftover paste in tablespoon dollops on parchment, then bag them — no more half-used cans growing mold.' },
  'coconut-milk': { tip: 'Leftover coconut milk keeps 4–5 days in a sealed container in the fridge, or freeze it in ice cube trays.' },
  'chicken-broth': { tip: 'An opened carton keeps about 5 days in the fridge. Freeze extra in ice cube trays or 1-cup containers.' },
  'vegetable-broth': { tip: 'An opened carton keeps about 5 days in the fridge. Freeze extra in ice cube trays or 1-cup containers.' },
  peanuts: { tip: 'Nuts go rancid in a warm pantry; keep open bags in the fridge or freezer.' },
  marinara: { tip: 'An opened jar keeps about a week in the fridge. Freeze leftovers in a zip-top bag laid flat.' },
  salsa: { tip: 'Refrigerate after opening and use within about 2 weeks.' },
  'frozen-peas': { tip: 'Press the air out and seal the bag after each use to prevent freezer burn.' },
  'frozen-broccoli': { tip: 'Press the air out and seal the bag after each use to prevent freezer burn.' },
};

export function withStorage(ingredients: Ingredient[]): Ingredient[] {
  return ingredients.map((ing) => {
    const s = STORAGE[ing.id];
    if (!s) return ing;
    return {
      ...ing,
      shelfLife: { ...ing.shelfLife, ...s.shelfLife },
      storageTip: s.tip,
      tipShelfLife: s.days,
      thawTip: s.thaw,
    };
  });
}
