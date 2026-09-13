// Recipe amounts you can flip between US and metric — the whole recipe, or one ingredient at a time.
import { ArrowLeftRight, Lightbulb, Snowflake } from 'lucide-react';
import { useState } from 'react';
import type { Ingredient, Location, RecipeIngredient, UnitSystem } from '../domain/types';
import { amountOptions, defaultOption, formatAmount, type AmountOption } from '../domain/units';

interface Prefs {
  system?: UnitSystem;
  flips: Record<string, string>; // `${index}:${ingredientId}` -> unit
}

const storeKey = (recipeId: string) => `units:${recipeId}`;

function load(recipeId: string): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(storeKey(recipeId)) ?? 'null');
    if (p && typeof p === 'object') return { system: p.system, flips: p.flips ?? {} };
  } catch {
    /* ignore */
  }
  return { flips: {} };
}

export interface LineAmount {
  text: string;
  options: AmountOption[];
  flipped: boolean;
  next: () => void;
}

export function useRecipeUnits(recipeId: string, fallback: UnitSystem) {
  const [prefs, setPrefs] = useState<Prefs>(() => load(recipeId));
  const save = (p: Prefs) => {
    setPrefs(p);
    try {
      localStorage.setItem(storeKey(recipeId), JSON.stringify(p));
    } catch {
      /* ignore */
    }
  };
  const system = prefs.system ?? fallback;

  const line = (ri: RecipeIngredient, idx: number, scale: number, ing: Ingredient | undefined): LineAmount => {
    const qty = ri.qty * scale;
    if (!ing || ri.qty <= 0) return { text: ri.qty > 0 ? formatAmount(qty, ri.unit) : '', options: [], flipped: false, next: () => {} };
    const key = `${idx}:${ri.ingredientId}`;
    const options = amountOptions(qty, ri.unit, ing);
    const def = defaultOption(options, system);
    const cur = options.find((o) => o.unit === prefs.flips[key]) ?? def;
    return {
      text: cur.text,
      options,
      flipped: cur.unit !== def.unit,
      next: () => {
        const nxt = options[(options.indexOf(cur) + 1) % options.length];
        const flips = { ...prefs.flips };
        if (nxt.unit === def.unit) delete flips[key];
        else flips[key] = nxt.unit;
        save({ ...prefs, flips });
      },
    };
  };

  return {
    system,
    hasFlips: Object.keys(prefs.flips).length > 0,
    setSystem: (s: UnitSystem) => save({ system: s, flips: prefs.flips }),
    resetFlips: () => save({ ...prefs, flips: {} }),
    line,
  };
}

/** Tap to cycle an amount through cups → grams → ml → oz. */
export function FlipAmount({ amount }: { amount: LineAmount }) {
  if (!amount.text) return null;
  if (amount.options.length < 2) return <span className="font-semibold">{amount.text}</span>;
  return (
    <button
      type="button"
      className={`inline-flex items-baseline gap-1 rounded-md px-1 -mx-1 font-semibold underline decoration-dotted decoration-stone-300 underline-offset-4 ${amount.flipped ? 'bg-sky-50 text-sky-800' : ''}`}
      aria-label={`${amount.text}, tap to switch units`}
      onClick={amount.next}
    >
      {amount.text}
      <ArrowLeftRight size={11} className="self-center text-stone-400" />
    </button>
  );
}

const LOC_LABEL: Record<Location, string> = { fridge: 'fridge', freezer: 'freezer', pantry: 'counter/pantry' };

export function tipLife(ing: Ingredient): string {
  const entries = Object.entries(ing.tipShelfLife ?? {}) as [Location, number][];
  if (!entries.length) return '';
  return entries
    .map(([loc, d]) => `${d >= 60 ? `${Math.round(d / 30)} months` : d >= 14 ? `${Math.round(d / 7)} weeks` : `${d} days`} in the ${LOC_LABEL[loc]}`)
    .join(', ');
}

/** Collapsible "how to keep it fresh / thaw it" advice for one ingredient. */
export function StorageTip({ ing, open, compact }: { ing: Ingredient; open?: boolean; compact?: boolean }) {
  const life = tipLife(ing);
  return (
    <details open={open} className={`group rounded-xl bg-emerald-50 text-sm text-emerald-950 ${compact ? 'px-3 py-2' : 'p-3'}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
        <Lightbulb size={15} className="shrink-0 text-emerald-600" />
        <span className="flex-1">Keep {ing.name.toLowerCase()} fresh{life ? ` · up to ${life}` : ''}</span>
        <span className="text-xs text-emerald-600 group-open:hidden">Show</span>
      </summary>
      {ing.storageTip && <p className="mt-2 leading-relaxed">{ing.storageTip}</p>}
      {ing.thawTip && (
        <p className="mt-2 flex gap-1.5 leading-relaxed">
          <Snowflake size={14} className="mt-0.5 shrink-0 text-sky-600" />
          <span>{ing.thawTip}</span>
        </p>
      )}
    </details>
  );
}
