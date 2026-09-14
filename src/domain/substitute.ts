// Swapping one ingredient for another in a recipe, so the plan, shopping list, pantry math,
// and the recipe text all follow the choice instead of it being a cook-time memory.
import { categoryOf } from './categories';
import type { Ingredient, Recipe, RecipeIngredient } from './types';
import { canConvert, displayQty, toBase } from './units';

/** Keep the recipe's amount when the new ingredient understands the unit; otherwise convert through base units. */
export function swapAmount(from: { qty: number; unit: string }, oldIng: Ingredient | undefined, newIng: Ingredient): { qty: number; unit: string } {
  if (canConvert(from.unit, newIng)) return { qty: from.qty, unit: from.unit };
  if (oldIng) {
    try {
      const base = toBase(from.qty, from.unit, oldIng);
      const units = oldIng.baseUnit === 'ea' ? ['ea'] : ['g', 'ml'];
      for (const u of units) {
        if (!canConvert(u, oldIng) || !canConvert(u, newIng)) continue;
        const asU = u === oldIng.baseUnit ? base : base / toBase(1, u, oldIng);
        return displayQty(toBase(asU, u, newIng), newIng);
      }
    } catch {
      // fall through
    }
  }
  return { qty: from.qty, unit: newIng.displayUnit ?? newIng.baseUnit };
}

/** New ingredient list with line `idx` swapped for `newIng`. Swapping back to the original clears the swap. */
export function substitute(recipe: Recipe, idx: number, newIng: Ingredient, ingById: Map<string, Ingredient>): RecipeIngredient[] {
  return recipe.ingredients.map((ri, i) => {
    if (i !== idx) return ri;
    const original = ri.swappedFrom ?? { ingredientId: ri.ingredientId, qty: ri.qty, unit: ri.unit };
    const { swappedFrom: _drop, ...rest } = ri;
    void _drop;
    if (newIng.id === original.ingredientId) return { ...rest, ...original };
    const amt = swapAmount(original, ingById.get(original.ingredientId), newIng);
    return { ...rest, ingredientId: newIng.id, qty: amt.qty, unit: amt.unit, swappedFrom: original };
  });
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Recipe step text with swapped ingredient names replaced ("vegetable broth" → "chicken broth"). */
export function displayStep(text: string, recipe: Recipe, ingById: Map<string, Ingredient>): string {
  let out = text;
  for (const ri of recipe.ingredients) {
    if (!ri.swappedFrom) continue;
    const oldIng = ingById.get(ri.swappedFrom.ingredientId);
    const newIng = ingById.get(ri.ingredientId);
    if (!oldIng || !newIng) continue;
    const names = [oldIng.name, ...oldIng.aliases].filter((n) => n.length > 2).sort((a, b) => b.length - a.length);
    const re = new RegExp(`\\b(${names.map(escape).join('|')})\\b`, 'gi');
    const to = newIng.name.toLowerCase();
    out = out.replace(re, (m) => (m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to));
  }
  return out;
}

/** Likely swaps: same food category and measurable the same way, closest names first. */
export function swapSuggestions(ing: Ingredient, all: Ingredient[], limit = 8): Ingredient[] {
  const cat = categoryOf(ing);
  const words = new Set(ing.name.toLowerCase().split(/\W+/).filter(Boolean));
  const score = (x: Ingredient) => x.name.toLowerCase().split(/\W+/).filter((w) => words.has(w)).length;
  return all
    .filter((x) => x.id !== ing.id && !x.alwaysOnHand && categoryOf(x) === cat && canConvert(ing.baseUnit, x))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
