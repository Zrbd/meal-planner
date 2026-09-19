// One search box over the whole app: recipes, things in the kitchen, planned meals, collections.
import Fuse from 'fuse.js';
import { BookMarked, CalendarDays, Refrigerator, UtensilsCrossed } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { relativeDayLabel } from '../domain/dates';
import { searchRecipes } from '../domain/search';
import { formatQty } from '../domain/units';
import { SearchInput, Sheet } from './components';
import { useAppData } from './data';

interface Hit {
  key: string;
  to: string;
  title: string;
  sub: string;
  icon: typeof UtensilsCrossed;
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useAppData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const term = q.trim();

  const ingFuse = useMemo(
    () => new Fuse(d.ingredients, { keys: ['name', 'aliases'], threshold: 0.35, ignoreLocation: true }),
    [d.ingredients],
  );

  const hits = useMemo<Hit[]>(() => {
    if (term.length < 2) return [];
    const out: Hit[] = [];

    for (const r of searchRecipes(d.recipes, term, { ingById: d.ingById }).slice(0, 6)) {
      out.push({ key: `r:${r.id}`, to: `/recipes/${r.id}`, title: r.title, sub: `${r.cuisine} recipe`, icon: UtensilsCrossed });
    }

    const stocked = new Map<string, number>();
    for (const l of d.lots) stocked.set(l.ingredientId, (stocked.get(l.ingredientId) ?? 0) + l.qty);
    for (const { item: ing } of ingFuse.search(term).slice(0, 5)) {
      const qty = stocked.get(ing.id);
      out.push({
        key: `i:${ing.id}`,
        to: `/pantry/${ing.id}`,
        title: ing.name,
        sub: qty ? `${formatQty(qty, ing, d.settings.units)} in the kitchen` : 'Not in stock',
        icon: Refrigerator,
      });
    }

    const lower = term.toLowerCase();
    for (const m of d.meals.filter((m) => m.date >= d.today).slice(0, 40)) {
      const r = d.recipeById.get(m.recipeId);
      if (!r || !r.title.toLowerCase().includes(lower)) continue;
      out.push({
        key: `m:${m.id}`,
        to: '/plan',
        title: r.title,
        sub: `Planned for ${relativeDayLabel(m.date, d.today)} · ${m.slot}`,
        icon: CalendarDays,
      });
      if (out.filter((h) => h.key.startsWith('m:')).length >= 3) break;
    }

    for (const c of d.collections.filter((c) => c.name.toLowerCase().includes(lower)).slice(0, 3)) {
      out.push({
        key: `c:${c.id}`,
        to: `/collections/${c.id}`,
        title: c.name,
        sub: `Collection · ${c.recipeIds.length} recipe${c.recipeIds.length === 1 ? '' : 's'}`,
        icon: BookMarked,
      });
    }
    return out;
  }, [term, d, ingFuse]);

  const go = (to: string) => {
    setQ('');
    onClose();
    navigate(to);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Search everything">
      <SearchInput value={q} onChange={setQ} autoFocus placeholder="Recipes, ingredients, planned meals…" />
      {term.length < 2 ? (
        <p className="pt-3 text-sm text-stone-500">
          Type a couple of letters. This looks through your recipes, what's in the kitchen, what's on the plan, and your collections all at once.
        </p>
      ) : hits.length === 0 ? (
        <p className="pt-3 text-sm text-stone-500">Nothing found for "{term}".</p>
      ) : (
        <ul className="card mt-3 divide-y divide-stone-100">
          {hits.map((h) => (
            <li key={h.key}>
              <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => go(h.to)}>
                <h.icon size={18} className="shrink-0 text-stone-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{h.title}</div>
                  <div className="truncate text-xs text-stone-500">{h.sub}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
