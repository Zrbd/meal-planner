// When produce is at its peak in the continental US, by month (1 = January).
// Only items with a real season are listed; anything missing is treated as available year-round,
// which is also true of most of the catalog (onions, garlic, carrots, bananas and so on).
//
// These are eating-quality windows, not shipping windows — a February tomato exists, it is just
// not worth building a meal around.

/** Month numbers, 1–12, when the item is at its best. */
export const SEASONS: Record<string, number[]> = {
  asparagus: [3, 4, 5, 6],
  arugula: [4, 5, 6, 9, 10],
  beets: [6, 7, 8, 9, 10, 11],
  'bell-pepper': [7, 8, 9, 10],
  blueberries: [6, 7, 8],
  'bok-choy': [3, 4, 5, 9, 10, 11],
  broccoli: [3, 4, 5, 9, 10, 11],
  'brussels-sprouts': [9, 10, 11, 12, 1],
  'butternut-squash': [9, 10, 11, 12, 1],
  cabbage: [1, 2, 9, 10, 11, 12],
  cauliflower: [3, 4, 9, 10, 11],
  'celery-root': [10, 11, 12, 1, 2],
  'cherry-tomatoes': [6, 7, 8, 9],
  'collard-greens': [1, 2, 10, 11, 12],
  'corn-on-cob': [6, 7, 8, 9],
  cucumber: [6, 7, 8, 9],
  eggplant: [7, 8, 9, 10],
  'green-beans': [6, 7, 8, 9],
  'green-tomato': [8, 9, 10],
  kale: [1, 2, 3, 10, 11, 12],
  leek: [9, 10, 11, 12, 1, 2],
  mango: [4, 5, 6, 7, 8],
  okra: [6, 7, 8, 9],
  orange: [12, 1, 2, 3, 4],
  peaches: [6, 7, 8, 9],
  pineapple: [3, 4, 5, 6, 7],
  poblano: [7, 8, 9, 10],
  radishes: [4, 5, 6, 9, 10],
  'snow-peas': [4, 5, 6],
  spinach: [3, 4, 5, 9, 10, 11],
  strawberries: [4, 5, 6, 7],
  'sweet-potato': [9, 10, 11, 12, 1],
  tomatillo: [7, 8, 9, 10],
  tomato: [7, 8, 9],
  zucchini: [6, 7, 8, 9],
};
