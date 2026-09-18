// Recipe search that behaves the way people expect: every word has to match something, a title
// that contains the whole phrase wins, and ingredients count — searching "honey chicken" puts the
// honey chicken recipes first instead of every chicken recipe. Pure; no DB, no React.
import type { Ingredient, Recipe } from './types';

export interface SearchOptions {
  ingById?: Map<string, Ingredient>;
  /** Keep near-misses (one word unmatched) at the bottom instead of dropping them. */
  loose?: boolean;
  limit?: number;
}

const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'with', 'of', 'in', 'for', 'on', 'my', 'some', 'recipe', 'recipes']);

export function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** Loose stem so "beans" finds "bean" and "tomatoes" finds "tomato". */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}

interface Haystack {
  title: string;
  words: Set<string>;
  ingredients: Set<string>;
  rest: string;
}

function haystack(r: Recipe, ingById?: Map<string, Ingredient>): Haystack {
  const title = r.title.toLowerCase();
  const words = new Set(tokenize(title).map(stem));
  const ingredients = new Set<string>();
  for (const ri of r.ingredients) {
    const ing = ingById?.get(ri.ingredientId);
    const name = ing?.name ?? ri.ingredientId.replace(/-/g, ' ');
    for (const w of tokenize(name)) ingredients.add(stem(w));
    for (const alias of ing?.aliases ?? []) for (const w of tokenize(alias)) ingredients.add(stem(w));
  }
  const rest = [r.cuisine, r.protein, r.description, ...(r.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
  return { title, words, ingredients, rest };
}

/** Score one recipe against one search word. 0 means the word is nowhere in it. */
function scoreWord(h: Haystack, word: string): number {
  const s = stem(word);
  if (h.words.has(s)) return 10;
  if (h.title.includes(word)) return 7;
  if (h.ingredients.has(s)) return 5;
  if (h.rest.includes(word)) return 2;
  // last resort: a word that starts the same way ("chick" → "chicken")
  if (word.length >= 4 && [...h.words].some((w) => w.startsWith(s) || s.startsWith(w))) return 3;
  if (word.length >= 4 && [...h.ingredients].some((w) => w.startsWith(s))) return 1.5;
  return 0;
}

export interface SearchHit {
  recipe: Recipe;
  score: number;
  /** False when a word in the query matched nothing — a near-miss kept for the tail of the list. */
  complete: boolean;
}

export function rankRecipes(recipes: Recipe[], query: string, o: SearchOptions = {}): SearchHit[] {
  const words = tokenize(query);
  if (!words.length) return recipes.map((recipe) => ({ recipe, score: 0, complete: true }));
  const phrase = query.trim().toLowerCase();
  const hits: SearchHit[] = [];
  for (const recipe of recipes) {
    const h = haystack(recipe, o.ingById);
    let score = 0;
    let missing = 0;
    for (const w of words) {
      const s = scoreWord(h, w);
      if (s === 0) missing++;
      score += s;
    }
    if (missing === words.length) continue;
    if (missing > 0 && !o.loose) continue;
    // The whole phrase in the title is what the searcher almost always meant.
    if (words.length > 1 && h.title.includes(phrase)) score += 25;
    else if (words.length > 1 && words.every((w) => h.words.has(stem(w)))) score += 12;
    if (h.title.startsWith(phrase)) score += 6;
    score -= missing * 6;
    hits.push({ recipe, score, complete: missing === 0 });
  }
  hits.sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title));
  return o.limit ? hits.slice(0, o.limit) : hits;
}

/** Recipes for a query, best first. Anything missing a search word is dropped. */
export function searchRecipes(recipes: Recipe[], query: string, o: SearchOptions = {}): Recipe[] {
  const strict = rankRecipes(recipes, query, o);
  // Nothing matched every word: fall back to near-misses so the screen is not empty.
  const hits = strict.length ? strict : rankRecipes(recipes, query, { ...o, loose: true });
  return hits.map((h) => h.recipe);
}
