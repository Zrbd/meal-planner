// Feature 10: the measurement cheat sheet. The card that lives inside a cupboard door, except
// it is in your pocket and searchable.
import { useState } from 'react';
import { CHEAT_SHEET, searchCheatSheet } from '../../data/cheatsheet';
import { EmptyState, PageHeader, SearchInput } from '../components';

export function CheatSheet() {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(CHEAT_SHEET[0].id);
  const sections = searchCheatSheet(query);
  const searching = query.trim().length > 0;

  return (
    <>
      <PageHeader title="Cheat sheet" subtitle="Conversions, temperatures, swaps" back />
      <div className="space-y-3 px-4 pb-8">
        <SearchInput value={query} onChange={setQuery} placeholder="Search, e.g. “butter” or “350”" />

        {sections.length === 0 && (
          <EmptyState emoji="📏" title="No match" body="Try a unit, an ingredient, or a temperature." />
        )}

        {sections.map((s) => {
          // While searching everything stays open, because the point is to see the hit.
          const open = searching || openId === s.id;
          return (
            <div key={s.id} className="card overflow-hidden">
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold"
                onClick={() => setOpenId(open && !searching ? null : s.id)}
              >
                {s.title}
                <span className="text-xs text-stone-400">{s.rows.length}</span>
              </button>
              {open && (
                <ul className="divide-y divide-stone-100 border-t border-stone-100">
                  {s.rows.map((r, i) => (
                    <li key={i} className="px-4 py-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-stone-600">{r.from}</span>
                        <span className="text-right font-semibold tabular-nums">{r.to}</span>
                      </div>
                      {r.note && <div className="mt-0.5 text-xs text-stone-400">{r.note}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
