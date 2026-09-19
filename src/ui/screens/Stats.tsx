// Kitchen stats: what you cooked, what it cost, what got thrown away.
import { Flame, Trash2, TrendingUp, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { addDaysISO, formatDay, relativeDayLabel, toISODate } from '../../domain/dates';
import { money } from '../../domain/prices';
import { kitchenStats, type Slice } from '../../domain/stats';
import { pantryValue } from '../../domain/pantryvalue';
import { formatQty } from '../../domain/units';
import { EmptyState, PageHeader, Segmented } from '../components';
import { useAppData } from '../data';
import { usePrices } from '../hooks';

type Window = '30' | '90' | 'all';
const WINDOWS: { value: Window; label: string }[] = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All time' },
];

function Bars({ slices, empty }: { slices: Slice[]; empty: string }) {
  if (!slices.length) return <p className="p-4 text-sm text-stone-500">{empty}</p>;
  return (
    <ul className="space-y-2 p-3">
      {slices.map((s) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="capitalize">{s.label}</span>
            <span className="text-stone-500">{s.count}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-stone-100">
            <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(4, s.share * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Last 5 weeks of cooking, one square per day. */
function Heatmap({ byDay, today }: { byDay: Map<string, number>; today: string }) {
  const days = Array.from({ length: 35 }, (_, i) => addDaysISO(today, i - 34));
  return (
    <div className="p-3">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const n = byDay.get(day) ?? 0;
          const tone = n === 0 ? 'bg-stone-100' : n === 1 ? 'bg-brand/40' : n === 2 ? 'bg-brand/70' : 'bg-brand';
          return <div key={day} className={`aspect-square rounded-md ${tone}`} title={`${formatDay(day)} · ${n} cooked`} />;
        })}
      </div>
      <p className="pt-2 text-center text-xs text-stone-500">Last five weeks · darker means more cooking</p>
    </div>
  );
}

export function Stats() {
  const d = useAppData();
  const prices = usePrices();
  const [win, setWin] = useState<Window>('90');
  const stats = useMemo(
    () =>
      kitchenStats({
        cookLogs: d.cookLogs, recipeById: d.recipeById, ingById: d.ingById, trips: d.trips,
        txns: d.txns, prices, today: d.today, now: d.now, days: win === 'all' ? undefined : Number(win),
      }),
    [d.cookLogs, d.recipeById, d.ingById, d.trips, d.txns, prices, d.today, d.now, win],
  );
  const value = useMemo(() => pantryValue(d.lots, prices), [d.lots, prices]);

  if (!d.cookLogs.length) {
    return (
      <>
        <PageHeader title="Kitchen stats" back />
        <EmptyState
          emoji="📊"
          title="Nothing cooked yet"
          body="Cook a meal from a recipe and this fills in: what you make most, what it costs, and how much food goes to waste."
          action={<Link to="/recipes" className="btn btn-primary">Find something to cook</Link>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Kitchen stats" subtitle={`${d.cookLogs.length} meals cooked in all`} back />
      <div className="space-y-3 px-4 pb-8">
        <Segmented<Window> value={win} options={WINDOWS} onChange={setWin} />

        <div className="grid grid-cols-2 gap-2">
          <div className="card p-3">
            <div className="flex items-center gap-1.5 text-xs text-stone-500"><Flame size={13} /> Cooking streak</div>
            <div className="text-2xl font-semibold">{stats.streak} day{stats.streak === 1 ? '' : 's'}</div>
            <div className="text-xs text-stone-500">Best run: {stats.bestStreak}</div>
          </div>
          <div className="card p-3">
            <div className="flex items-center gap-1.5 text-xs text-stone-500"><TrendingUp size={13} /> Meals cooked</div>
            <div className="text-2xl font-semibold">{stats.cooks}</div>
            <div className="text-xs text-stone-500">{stats.distinctRecipes} different recipes</div>
          </div>
          <div className="card p-3">
            <div className="flex items-center gap-1.5 text-xs text-stone-500"><Wallet size={13} /> Groceries</div>
            <div className="text-2xl font-semibold">{stats.spend > 0 ? money(stats.spend) : '—'}</div>
            <div className="text-xs text-stone-500">
              {stats.costPerCook ? `${money(stats.costPerCook)} per meal cooked` : `${stats.trips} shopping trip${stats.trips === 1 ? '' : 's'}`}
            </div>
          </div>
          <div className="card p-3">
            <div className="flex items-center gap-1.5 text-xs text-stone-500"><Trash2 size={13} /> Thrown out</div>
            <div className="text-2xl font-semibold">{stats.wasteCost > 0 ? money(stats.wasteCost) : stats.waste.length || '—'}</div>
            <div className="text-xs text-stone-500">{stats.waste.length ? `${stats.waste.length} item${stats.waste.length === 1 ? '' : 's'}` : 'Nothing wasted'}</div>
          </div>
        </div>

        <h2 className="section-title">When you cook</h2>
        <div className="card"><Heatmap byDay={stats.byDay} today={d.today} /></div>

        <h2 className="section-title">Made most often</h2>
        <div className="card divide-y divide-stone-100">
          {stats.top.length === 0 && <p className="p-4 text-sm text-stone-500">Nothing cooked in this window.</p>}
          {stats.top.map((t, i) => (
            <Link key={t.recipeId} to={`/recipes/${t.recipeId}`} className="flex items-center gap-3 p-3">
              <span className="w-5 text-center text-sm font-semibold text-stone-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{t.title}</div>
                <div className="text-xs text-stone-500">Last made {relativeDayLabel(toISODate(new Date(t.lastAt)), d.today).toLowerCase()}</div>
              </div>
              <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">×{t.count}</span>
            </Link>
          ))}
        </div>

        <h2 className="section-title">Cuisines</h2>
        <div className="card"><Bars slices={stats.cuisines} empty="No cuisines recorded yet." /></div>

        <h2 className="section-title">Proteins</h2>
        <div className="card"><Bars slices={stats.proteins} empty="No proteins recorded yet." /></div>

        {stats.waste.length > 0 && (
          <>
            <h2 className="section-title">What went in the bin</h2>
            <div className="card divide-y divide-stone-100">
              {stats.waste.map((w) => {
                const ing = d.ingById.get(w.ingredientId);
                return (
                  <Link key={w.ingredientId} to={`/pantry/${w.ingredientId}`} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{w.name}</div>
                      <div className="text-xs text-stone-500">
                        {ing ? formatQty(w.qty, ing, d.settings.units) : w.qty} · {w.events} time{w.events === 1 ? '' : 's'}
                      </div>
                    </div>
                    {w.cost !== undefined && <span className="shrink-0 text-sm text-red-700">{money(w.cost)}</span>}
                  </Link>
                );
              })}
            </div>
            <p className="px-1 text-xs text-stone-500">
              Tossing something from the pantry records it here, so you can see what you keep over-buying.
            </p>
          </>
        )}

        {value.total > 0 && (
          <>
            <h2 className="section-title">What's in the kitchen right now</h2>
            <div className="card p-3">
              <div className="text-2xl font-semibold">{money(value.total)}</div>
              <div className="text-xs text-stone-500">
                Fridge {money(value.byLocation.fridge)} · Freezer {money(value.byLocation.freezer)} · Pantry {money(value.byLocation.pantry)}
              </div>
              {value.unpricedItems > 0 && (
                <p className="pt-2 text-xs text-stone-500">
                  {value.unpricedItems} item{value.unpricedItems === 1 ? '' : 's'} have no price yet — add prices as you shop and this gets sharper.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
