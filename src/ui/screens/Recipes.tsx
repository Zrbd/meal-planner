import Fuse from 'fuse.js';
import { ClipboardPaste, PenLine, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { Recipe } from '../../domain/types';
import { EmptyState, PageHeader, RecipeCard, SearchInput, Sheet, totalTime } from '../components';
import { useAppData } from '../data';
import { useCoverage } from '../hooks';

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
];

export function Recipes() {
  const { recipes } = useAppData();
  const coverage = useCoverage();
  const [params, setParams] = useSearchParams();
  const filter = params.get('f') ?? 'all';
  const [q, setQ] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const fuse = useMemo(
    () => new Fuse(recipes, { keys: ['title', 'cuisine', 'protein', 'description'], threshold: 0.35, ignoreLocation: true }),
    [recipes],
  );

  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    const base = q.trim() ? fuse.search(q.trim()).map((r) => r.item) : [...recipes].sort((a, b) => a.title.localeCompare(b.title));
    const out = base.filter((r) => r.archived === showHidden && f.test(r, !!coverage.get(r.id)?.canMake));
    if (!q.trim()) out.sort((a, b) => (coverage.get(b.id)?.ratio ?? 0) - (coverage.get(a.id)?.ratio ?? 0) || Number(b.favorite) - Number(a.favorite));
    return out;
  }, [recipes, q, fuse, filter, showHidden, coverage]);

  const hiddenCount = recipes.filter((r) => r.archived).length;

  return (
    <>
      <PageHeader
        title="Recipes"
        subtitle={`${recipes.filter((r) => !r.archived).length} recipes`}
        right={
          <button className="icon-btn" aria-label="Add recipe" onClick={() => setAddOpen(true)}>
            <Plus size={24} />
          </button>
        }
      />
      <div className="space-y-3 px-4">
        <SearchInput value={q} onChange={setQ} placeholder="Search recipes, cuisines…" />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`chip ${filter === f.id ? 'chip-on' : ''}`}
              onClick={() => setParams(f.id === 'all' ? {} : { f: f.id }, { replace: true })}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {list.map((r) => (
            <RecipeCard key={r.id} recipe={r} coverage={coverage.get(r.id)} />
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
