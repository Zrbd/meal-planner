import { BookMarked, ClipboardPaste, Dices, PenLine, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { Recipe } from '../../domain/types';
import { EmptyState, PageHeader, RecipeCard, SearchInput, Sheet, totalTime } from '../components';
import { useAppData } from '../data';
import { useCoverage, useDishInfo } from '../hooks';
import { DISH_TYPES, PROTEIN_TYPES } from '../../domain/dishes';
import { searchRecipes } from '../../domain/search';
import { lastCooked } from '../../domain/rotation';
import { daysBetween, toISODate } from '../../domain/dates';
import { inSeason } from '../../domain/seasons';

const FILTERS: { id: string; label: string; test: (r: Recipe, canMake: boolean) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'canmake', label: 'Can make now', test: (_, c) => c },
  { id: 'fav', label: '❤️ Favorites', test: (r) => r.favorite },
  { id: 'mine', label: 'My recipes', test: (r) => r.source === 'user' },
  { id: 'quick', label: '≤ 30 min', test: (r) => totalTime(r) <= 30 },
  { id: 'dinner', label: 'Dinner', test: (r) => r.slots.includes('dinner') },
  { id: 'breakfast', label: 'Breakfast', test: (r) => r.slots.includes('breakfast') },
  { id: 'lunch', label: 'Lunch', test: (r) => r.slots.includes('lunch') },
  { id: 'veg', label: 'Vegetarian', test: (r) => r.diet.includes('vegetarian') },
  { id: 'sides', label: 'Sides', test: (r) => r.role === 'side' },
  { id: 'season', label: '🌿 In season', test: () => true },
  { id: 'smoker', label: '🔥 Smoker', test: (r) => !!r.tags?.includes('smoker') },
  // Handled specially in the list below — it needs the cook log, not just the recipe.
  { id: 'stale', label: '⏳ Not lately', test: () => true },
];

export function Recipes() {
  const d = useAppData();
  const { recipes, ingById } = d;
  const navigate = useNavigate();
  const coverage = useCoverage();
  const dish = useDishInfo();
  const [params, setParams] = useSearchParams();
  const filter = params.get('f') ?? 'all';
  const cuisine = params.get('c') ?? '';
  const protein = params.get('p') ?? '';
  const dishType = params.get('t') ?? '';
  const collectionId = params.get('k') ?? '';
  /** Change one filter and keep the others (the URL remembers them for the back button). */
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const cuisines = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) if (!r.archived && r.cuisine) counts.set(r.cuisine, (counts.get(r.cuisine) ?? 0) + 1);
    return [...counts].sort((a, b) => a[0].localeCompare(b[0]));
  }, [recipes]);
  const [q, setQ] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const cooked = useMemo(() => lastCooked(d.cookLogs), [d.cookLogs]);
  const inCollection = useMemo(
    () => (collectionId ? new Set(d.collections.find((c) => c.id === collectionId)?.recipeIds ?? []) : null),
    [collectionId, d.collections],
  );

  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    const base = q.trim() ? searchRecipes(recipes, q.trim(), { ingById }) : [...recipes].sort((a, b) => a.title.localeCompare(b.title));
    const out = base.filter((r) => {
      if (r.archived !== showHidden || !f.test(r, !!coverage.get(r.id)?.canMake)) return false;
      const info = dish.get(r.id);
      if (cuisine && r.cuisine !== cuisine) return false;
      if (protein && info?.protein !== protein) return false;
      if (dishType && info?.dishType !== dishType) return false;
      if (inCollection && !inCollection.has(r.id)) return false;
      if (filter === 'season' && !r.ingredients.some((ri) => !ri.optional && inSeason(ri.ingredientId, d.today))) return false;
      if (filter === 'stale') {
        const at = cooked.get(r.id);
        // Never cooked doesn't count as "not lately" — this is for things you liked and forgot.
        if (at === undefined) return false;
        if (daysBetween(toISODate(new Date(at)), d.today) < 30) return false;
      }
      return true;
    });
    if (!q.trim()) out.sort((a, b) => (coverage.get(b.id)?.ratio ?? 0) - (coverage.get(a.id)?.ratio ?? 0) || Number(b.favorite) - Number(a.favorite));
    if (filter === 'stale') out.sort((a, b) => (cooked.get(a.id) ?? 0) - (cooked.get(b.id) ?? 0));
    if (filter === 'season') {
      const peak = (r: Recipe) => r.ingredients.filter((ri) => inSeason(ri.ingredientId, d.today)).length;
      out.sort((a, b) => peak(b) - peak(a));
    }
    return out;
  }, [recipes, q, ingById, filter, showHidden, coverage, dish, cuisine, protein, dishType, inCollection, cooked, d.today]);

  const hiddenCount = recipes.filter((r) => r.archived).length;

  return (
    <>
      <PageHeader
        title="Recipes"
        subtitle={`${recipes.filter((r) => !r.archived).length} recipes`}
        right={
          <>
            <button
              className="icon-btn"
              aria-label="Surprise me"
              disabled={!list.length}
              onClick={() => navigate(`/recipes/${list[Math.floor(Math.random() * list.length)].id}`)}
            >
              <Dices size={22} />
            </button>
            <Link className="icon-btn" aria-label="Collections" to="/collections"><BookMarked size={21} /></Link>
            <button className="icon-btn" aria-label="Add recipe" onClick={() => setAddOpen(true)}>
              <Plus size={24} />
            </button>
          </>
        }
      />
      <div className="space-y-3 px-4">
        <SearchInput value={q} onChange={setQ} placeholder="Search recipes, cuisines…" />
        <Link to="/find" className="card flex items-center gap-2 px-3 py-2 text-sm">
          <Search size={16} className="text-brand" />
          <span className="flex-1">Cook with what's in the fridge</span>
          <span className="text-stone-400">›</span>
        </Link>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`chip ${filter === f.id ? 'chip-on' : ''}`}
              onClick={() => setParam('f', f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {d.collections.length > 0 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {d.collections.map((c) => (
              <button
                key={c.id}
                className={`chip ${collectionId === c.id ? 'chip-on' : ''}`}
                onClick={() => setParam('k', collectionId === c.id ? '' : c.id)}
              >
                {c.emoji ?? '📚'} {c.name}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <select className={`input px-2 py-1.5 text-sm ${dishType ? 'border-brand text-brand' : ''}`} aria-label="Type of dish" value={dishType} onChange={(e) => setParam('t', e.target.value)}>
            <option value="">Any dish</option>
            {DISH_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select className={`input px-2 py-1.5 text-sm ${protein ? 'border-brand text-brand' : ''}`} aria-label="Protein" value={protein} onChange={(e) => setParam('p', e.target.value)}>
            <option value="">Any protein</option>
            {PROTEIN_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select className={`input px-2 py-1.5 text-sm ${cuisine ? 'border-brand text-brand' : ''}`} aria-label="Cuisine" value={cuisine} onChange={(e) => setParam('c', e.target.value)}>
            <option value="">Any cuisine</option>
            {cuisines.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
          </select>
        </div>
        {(cuisine || protein || dishType || collectionId) && (
          <div className="flex items-center justify-between px-1 text-sm text-stone-500">
            <span>{list.length} recipe{list.length === 1 ? '' : 's'}</span>
            <button className="text-brand font-medium" onClick={() => setParams(filter === 'all' ? {} : { f: filter }, { replace: true })}>Clear filters</button>
          </div>
        )}
        <div className="space-y-2">
          {list.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              coverage={coverage.get(r.id)}
              subtitle={
                filter === 'season' ? (
                  <span className="truncate">
                    🌿 {[...new Set(r.ingredients.filter((ri) => inSeason(ri.ingredientId, d.today)).map((ri) => ingById.get(ri.ingredientId)?.name.toLowerCase() ?? ri.ingredientId))].slice(0, 3).join(', ')}
                  </span>
                ) : undefined
              }
            />
          ))}
        </div>
        {list.length === 0 && (
          <EmptyState
            emoji={filter === 'mine' ? '📝' : '🔍'}
            title={filter === 'mine' ? 'No recipes of your own yet' : 'No recipes found'}
            body={filter === 'mine' ? 'Add family favorites — type them in or paste from anywhere.' : 'Try another search or filter.'}
            action={filter === 'mine' ? <button className="btn btn-primary" onClick={() => setAddOpen(true)}><Plus size={18} /> Add a recipe</button> : undefined}
          />
        )}
        {(hiddenCount > 0 || showHidden) && (
          <button className="btn btn-ghost w-full text-sm" onClick={() => setShowHidden(!showHidden)}>
            {showHidden ? 'Back to recipes' : `Show ${hiddenCount} hidden recipe${hiddenCount === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      <button
        className="btn btn-primary fixed right-4 z-20 h-14 w-14 rounded-full p-0 shadow-lg bottom-safe-tab"
        aria-label="Add recipe"
        onClick={() => setAddOpen(true)}
      >
        <Plus size={28} />
      </button>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add a recipe">
        <div className="space-y-2">
          <Link to="/recipes/new" className="card flex items-center gap-3 p-4">
            <PenLine className="text-brand" />
            <div>
              <div className="font-semibold">Type it in</div>
              <div className="text-sm text-stone-500">Step-by-step form for a family recipe.</div>
            </div>
          </Link>
          <Link to="/recipes/import" className="card flex items-center gap-3 p-4">
            <ClipboardPaste className="text-brand" />
            <div>
              <div className="font-semibold">Paste a recipe</div>
              <div className="text-sm text-stone-500">Copy from a website, note, or text — we'll sort out ingredients and steps.</div>
            </div>
          </Link>
        </div>
      </Sheet>
    </>
  );
}
