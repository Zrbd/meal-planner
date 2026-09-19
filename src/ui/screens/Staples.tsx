// The things that should simply always be in the house, all on one screen.
import { Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { aisleEmoji, aisleLabel } from '../../data/aisles';
import type { Ingredient } from '../../domain/types';
import { setKeepStocked, suggestStaples } from '../../services/staples';
import { EmptyState, PageHeader, SearchInput } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';

export function Staples() {
  const { ingredients, ingById } = useAppData();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [suggested, setSuggested] = useState<string[] | null>(null);

  const kept = useMemo(
    () => ingredients.filter((i) => i.keepStocked).sort((a, b) => a.name.localeCompare(b.name)),
    [ingredients],
  );
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return ingredients
      .filter((i) => !i.keepStocked && (i.name.toLowerCase().includes(needle) || i.aliases.some((a) => a.toLowerCase().includes(needle))))
      .slice(0, 12);
  }, [ingredients, q]);

  const row = (i: Ingredient, on: boolean) => (
    <li key={i.id} className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{i.name}</div>
        <div className="text-xs text-stone-500">{aisleEmoji(i.aisle)} {aisleLabel(i.aisle)}</div>
      </div>
      <button
        className={`btn px-3 py-1.5 text-sm ${on ? 'btn-ghost text-red-600' : 'btn-secondary'}`}
        onClick={() => void setKeepStocked([i.id], !on).then(() => toast(on ? `${i.name} is no longer a staple` : `${i.name} is a staple`))}
      >
        {on ? 'Remove' : 'Keep stocked'}
      </button>
    </li>
  );

  const suggest = async () => {
    const ids = await suggestStaples();
    setSuggested(ids);
    if (!ids.length) toast('Nothing new to suggest yet');
  };

  return (
    <>
      <PageHeader title="Staples" subtitle={`${kept.length} kept stocked`} back="/settings" />
      <div className="space-y-4 px-4 pb-8">
        <p className="px-1 text-sm text-stone-500">
          Staples get onto the shopping list as soon as they run low, whether or not a planned meal needs them.
        </p>

        <SearchInput value={q} onChange={setQ} placeholder="Add a staple…" />
        {matches.length > 0 && <ul className="card divide-y divide-stone-100">{matches.map((i) => row(i, false))}</ul>}

        {suggested === null ? (
          <button className="btn btn-secondary w-full" onClick={() => void suggest()}>
            <Sparkles size={17} /> Suggest from what you cook
          </button>
        ) : suggested.length > 0 ? (
          <section>
            <h2 className="section-title">✨ Used in a lot of your meals</h2>
            <ul className="card divide-y divide-stone-100">
              {suggested.map((id) => ingById.get(id)).filter((i) => !!i).map((i) => row(i, false))}
            </ul>
            <button
              className="btn btn-primary mt-2 w-full"
              onClick={() => void setKeepStocked(suggested, true).then(() => { toast(`${suggested.length} staples added`); setSuggested([]); })}
            >
              Keep all of them stocked
            </button>
          </section>
        ) : null}

        <section>
          <h2 className="section-title pt-2">🧂 Always on hand</h2>
          {kept.length === 0 ? (
            <EmptyState emoji="🧂" title="No staples yet" body="Search above for the things you never want to run out of — oil, rice, eggs, coffee." />
          ) : (
            <ul className="card divide-y divide-stone-100">{kept.map((i) => row(i, true))}</ul>
          )}
        </section>
      </div>
    </>
  );
}
