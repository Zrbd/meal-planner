// Feature 12: the month view. The week screen answers "what's for dinner"; this one answers
// "how much chicken have we had" and "which nights are still empty before the long weekend".
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatDay } from '../../domain/dates';
import { monthGrid, monthStart, shiftMonth, weekdayHeaders } from '../../domain/month';
import { PageHeader } from '../components';
import { useAppData } from '../data';

// Kept deliberately muted: the grid should read as a calendar, not a pie chart.
const PROTEIN_DOT: Record<string, string> = {
  chicken: 'bg-amber-400',
  pork: 'bg-rose-400',
  turkey: 'bg-orange-400',
  shrimp: 'bg-pink-400',
  seafood: 'bg-sky-400',
  egg: 'bg-yellow-400',
  beans: 'bg-lime-500',
  tofu: 'bg-teal-400',
  vegetarian: 'bg-green-500',
  cheese: 'bg-yellow-300',
};

export function MonthPlan() {
  const { meals, recipeById, settings, today } = useAppData();
  const [month, setMonth] = useState(() => monthStart(today));
  const [selected, setSelected] = useState(today);

  const grid = monthGrid(month, meals, recipeById, settings.weekStartsOn, today);
  const day = grid.weeks.flat().find((c) => c.date === selected);
  const proteins = Object.entries(grid.proteinCounts).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader title={grid.label} subtitle={`${grid.plannedCount} meals · ${grid.emptyDinners} empty dinners`} back="/plan" />
      <div className="space-y-4 px-4 pb-8">
        <div className="flex items-center justify-between">
          <button className="icon-btn" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft size={24} />
          </button>
          <button className="text-sm font-medium text-brand" onClick={() => setMonth(monthStart(today))}>
            Today
          </button>
          <button className="icon-btn" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="card p-2">
          <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold text-stone-400">
            {weekdayHeaders(settings.weekStartsOn).map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {grid.weeks.flat().map((cell) => (
              <button
                key={cell.date}
                onClick={() => setSelected(cell.date)}
                className={`flex aspect-square flex-col items-center justify-start rounded-lg pt-1 text-xs ${
                  cell.inMonth ? '' : 'opacity-30'
                } ${cell.date === selected ? 'bg-brand-soft' : ''}`}
              >
                <span className={`${cell.isToday ? 'flex h-5 w-5 items-center justify-center rounded-full bg-brand font-bold text-white' : 'font-medium'}`}>
                  {Number(cell.date.slice(8))}
                </span>
                <span className="mt-1 flex gap-0.5">
                  {cell.dots.map((d, i) => (
                    <span key={i} className={`h-1.5 w-1.5 rounded-full ${PROTEIN_DOT[d.protein ?? ''] ?? 'bg-stone-300'}`} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>

        {proteins.length > 0 && (
          <div>
            <div className="section-title">This month</div>
            <div className="flex flex-wrap gap-2">
              {proteins.map(([p, n]) => (
                <span key={p} className="chip">
                  <span className={`h-2 w-2 rounded-full ${PROTEIN_DOT[p] ?? 'bg-stone-300'}`} />
                  {p} · {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {day && (
          <div>
            <div className="section-title">{formatDay(day.date, 'EEEE, MMMM d')}</div>
            {day.meals.length === 0 ? (
              <Link to="/plan" className="card block p-4 text-sm text-stone-500">
                Nothing planned — open the week to fill it in.
              </Link>
            ) : (
              <ul className="card divide-y divide-stone-100">
                {day.meals.map((m) => {
                  const r = recipeById.get(m.recipeId);
                  return (
                    <li key={m.id}>
                      <Link to={`/recipes/${m.recipeId}`} className="flex items-center gap-3 p-3">
                        <span className="w-16 text-xs text-stone-400 capitalize">{m.slot}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{r?.title ?? 'Unknown recipe'}</span>
                        {m.status === 'cooked' && <span className="text-xs text-brand">cooked</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}
