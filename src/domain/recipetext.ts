// A recipe as plain text — for sharing, printing, or pasting into a message.
import { renderStep } from './steptext';
import type { Ingredient, Recipe, UnitSystem } from './types';
import { amountOptions, defaultOption } from './units';

export interface RecipeTextOptions {
  servings?: number;
  system?: UnitSystem;
  ingById: Map<string, Ingredient>;
  /** Include the "from" credit line. On by default — built-ins are other people's work. */
  credit?: boolean;
}

function amountText(qty: number, unit: string, ing: Ingredient | undefined, system: UnitSystem): string {
  if (qty <= 0) return '';
  if (!ing) return `${qty} ${unit}`.trim();
  const options = amountOptions(qty, unit, ing);
  return defaultOption(options, system).text;
}

/** The whole recipe as text: title, meta, ingredients (with groups), steps, notes, credit. */
export function recipeToText(recipe: Recipe, o: RecipeTextOptions): string {
  const servings = o.servings ?? recipe.baseServings;
  const system = o.system ?? 'us';
  const scale = servings / (recipe.baseServings || 1);
  const out: string[] = [recipe.title];
  if (recipe.description) out.push(recipe.description);
  const meta = [
    `Serves ${servings}`,
    recipe.prepMin ? `${recipe.prepMin} min prep` : '',
    recipe.cookMin ? `${recipe.cookMin} min cook` : '',
    recipe.cuisine,
  ].filter(Boolean);
  out.push(meta.join(' · '), '', 'INGREDIENTS');

  let group: string | undefined;
  for (const ri of recipe.ingredients) {
    if (ri.group && ri.group !== group) {
      group = ri.group;
      out.push(`  ${group}`);
    }
    const ing = o.ingById.get(ri.ingredientId);
    const amount = amountText(ri.qty * scale, ri.unit, ing, system);
    const name = ing?.name.toLowerCase() ?? ri.ingredientId;
    const extras = [ri.prep, ri.optional ? 'optional' : ''].filter(Boolean).join(', ');
    out.push(`- ${[amount, name].filter(Boolean).join(' ')}${extras ? `, ${extras}` : ''}`);
  }

  out.push('', 'STEPS');
  recipe.steps.forEach((s, i) => {
    out.push(`${i + 1}. ${renderStep(s, { scale, system, recipe, ingById: o.ingById })}`);
  });

  if (recipe.notes) out.push('', `Notes: ${recipe.notes}`);
  if (recipe.credit && o.credit !== false) {
    const who = recipe.credit.author ? `${recipe.credit.author} — ${recipe.credit.name}` : recipe.credit.name;
    out.push('', `Adapted from ${who}`, recipe.credit.url);
  }
  return out.join('\n');
}

/** A whole week of meals as a short text plan. */
export function planToText(input: {
  days: { date: string; label: string; meals: { slot: string; title: string; servings: number }[] }[];
}): string {
  const out: string[] = [];
  for (const d of input.days) {
    if (!d.meals.length) continue;
    out.push(d.label);
    for (const m of d.meals) out.push(`  ${m.slot}: ${m.title} (${m.servings})`);
  }
  return out.join('\n');
}
