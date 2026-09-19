// Price book: what you have actually paid for things, and what is getting dearer.
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { formatDay, toISODate } from '../../domain/dates';
import { money, priceBook, type PriceBookEntry } from '../../domain/prices';
import { displayQty } from '../../domain/units';
import { EmptyState, PageHeader, SearchInput, Segmented } from '../components';
import { useAppData } from '../data';

type Sort = 'name' | 'change' | 'spend';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'name', label: 'A–Z' },
  { value: 'change', label: 'Gone up' },
  { value: 'spend', label: 'Biggest spend' },
];

/** "$3.40 / lb" — priced in a unit a person actually buys in. */
function perUnit(entry: PriceBookEntry, ing: { baseUnit: string } & Parameters<typeof displayQty>[1], us: 'us' | 'metric') {
  const sample = ing.baseUnit === 'ea' ? 1 : ing.baseUnit === 'g' ? 453.6 : 1000;
  const { qty, unit } = displayQty(sample, ing, us);
  return `${money(entry.latest * sample)} / ${qty === 1 ? unit : `${qty} ${unit}`}`;
}

export function PriceBook() {
  const d = useAppData();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const book = useMemo(() => priceBook(d.trips, d.ingById), [d.trips, d.ingById]);
  const spendById = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of d.trips) for (const l of t.lines) if (l.ingredientId && l.price) m.set(l.ingredientId, (m.get(l.ingredientId) ?? 0) + l.price);
    return m;
  }, [d.trips]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = book.filter((e) => !term || e.name.toLowerCase().includes(term));
    if (sort === 'change') return [...rows].sort((a, b) => (b.change ?? -99) - (a.change ?? -99));
    if (sort === 'spend') return [...rows].sort((a, b) => (spendById.get(b.ingredientId) ?? 0) - (spendById.get(a.ingredientId) ?? 0));
    return rows;
  }, [book, q, sort, spendById]);

  if (!book.length) {
    return (
      <>
        <PageHeader title="Price book" back />
        <EmptyState
          emoji="🏷️"
          title="No prices recorded yet"
          body="Type in what you paid when you finish a shopping trip, and every price lands here — so you can tell a good deal from a bad one."
          action={<Link to="/shop" className="btn btn-primary">Go to the shopping list</Link>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Price book" subtitle={`${book.length} item${book.length === 1 ? '' : 's'} priced`} back />
      <div className="space-y-3 px-4 pb-8">
        <SearchInput value={q} onChange={setQ} placeholder="Search priced items" />
        <Segmented<Sort> value={sort} options={SORTS} onChange={setSort} />
        <ul className="card divide-y divide-stone-100">
          {list.map((e) => {
            const ing = d.ingById.get(e.ingredientId)!;
            const up = (e.change ?? 0) > 0.05;
            const down = (e.change ?? 0) < -0.05;
            const last = e.points[0];
            return (
              <li key={e.ingredientId}>
                <Link to={`/pantry/${e.ingredientId}`} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.name}</div>
                    <div className="text-xs text-stone-500">
                      {perUnit(e, ing, d.settings.units)}
                      {e.points.length > 1 && ` · ${e.points.length} prices · low ${money(e.low * (ing.baseUnit === 'ea' ? 1 : ing.baseUnit === 'g' ? 453.6 : 1000))}`}
                    </div>
                    <div className="text-xs text-stone-400">
                      Last paid {money(last.paid)} on {formatDay(toISODate(new Date(last.at)), 'MMM d')}
                    </div>
                  </div>
                  {(up || down) && (
                    <span className={`flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold ${up ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      {Math.abs(Math.round((e.change ?? 0) * 100))}%
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="px-1 text-xs text-stone-500">
          Prices come from what you typed in when finishing a shopping trip. The newest price is the one used to estimate a recipe's cost.
        </p>
      </div>
    </>
  );
}
