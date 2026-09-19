// "I have these things — what can I make?" Pick ingredients, get recipes ranked by how
// much of the dish your picks actually cover.
import { Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { recipesUsing } from '../../domain/pantryvalue';
import { isOld } from '../../domain/freshness';
import { formatQty } from '../../domain/units';
import { EmptyState, IngredientPicker, PageHeader, RecipeCard } from '../components';
import { useAppData } from '../data';
import { useCoverage } from '../hooks';

export function FindByIngredient() {
  const d = useAppData();
  const coverage = useCoverage();
  const [params, setParams] = useSearchParams();
  const picked = (params.get('i') ?? '').split(',').filter(Boolean);
  const [pickOpen, setPickOpen] = useState(false);

  const setPicked = (ids: string[]) => setParams(ids.length ? { i: [...new Set(ids)].join(',') } : {}, { replace: true });

  /** Things in the fridge that have been sitting a while — the usual reason to come here. */
  const suggestions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const l of d.lots) {
      const ing = d.ingById.get(l.ingredientId);
      if (!ing || ing.alwaysOnHand || picked.includes(l.ingredientId)) continue;
      const urgent = (l.expiresOn && l.expiresOn <= d.today) || isOld(l, ing, d.today);
      if (!urgent) continue;
      seen.set(l.ingredientId, (seen.get(l.ingredientId) ?? 0) + l.qty);
    }
    return [...seen].slice(0, 8);
  }, [d.lots, d.ingById, d.today, picked]);

  const matches = useMemo(
    () => recipesUsing({ ingredientIds: picked, recipes: d.recipes, ingById: d.ingById, servings: d.settings.householdSize }),
    [picked, d.recipes, d.ingById, d.settings.householdSize],
  );

  return (
    <>
      <PageHeader title="Cook with…" subtitle="Pick what you want to use up" back />
      <div className="space-y-3 px-4 pb-8">
        <div className="card p-3">
          <div className="flex flex-wrap gap-2">
            {picked.map((id) => (
              <button key={id} className="chip chip-on" onClick={() => setPicked(picked.filter((x) => x !== id))}>
                {d.ingById.get(id)?.name ?? id} <X size={13} />
              </button>
            ))}
            <button className="chip" onClick={() => setPickOpen(true)}>+ Add an ingredient</button>
          </div>
          {picked.length > 0 && (
            <button className="mt-2 text-sm font-medium text-brand" onClick={() => setPicked([])}>Clear all</button>
          )}
        </div>

        {suggestions.length > 0 && (
          <>
            <h2 className="section-title">Use these up first</h2>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {suggestions.map(([id, qty]) => {
                const ing = d.ingById.get(id)!;
                return (
                  <button key={id} className="chip" onClick={() => setPicked([...picked, id])}>
                    {ing.name} <span className="text-stone-400">{formatQty(qty, ing, d.settings.units)}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {picked.length === 0 ? (
          <EmptyState
            emoji="🧑‍🍳"
            title="What have you got?"
            body="Add a couple of ingredients — half a cabbage, that chicken thigh — and we'll show the recipes that lean on them hardest."
            action={<button className="btn btn-primary" onClick={() => setPickOpen(true)}><Sparkles size={18} /> Pick ingredients</button>}
          />
        ) : matches.length === 0 ? (
          <EmptyState emoji="🤔" title="Nothing uses all of that" body="Try removing one of the ingredients." />
        ) : (
          <>
            <h2 className="section-title">{matches.length} recipe{matches.length === 1 ? '' : 's'}</h2>
            <div className="space-y-2">
              {matches.map((m) => (
                <RecipeCard
                  key={m.recipe.id}
                  recipe={m.recipe}
                  coverage={coverage.get(m.recipe.id)}
                  subtitle={`Uses ${m.hitIds.map((id) => d.ingById.get(id)?.name.toLowerCase() ?? id).join(', ')}`}
                />
              ))}
            </div>
          </>
        )}

        <p className="px-1 text-center text-xs text-stone-500">
          Looking for meals you can make with no shopping at all? <Link className="text-brand" to="/recipes?f=canmake">Can make now</Link>.
        </p>
      </div>

      <IngredientPicker
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        title="What do you want to use?"
        onPick={(id) => {
          setPicked([...picked, id]);
          setPickOpen(false);
        }}
      />
    </>
  );
}
