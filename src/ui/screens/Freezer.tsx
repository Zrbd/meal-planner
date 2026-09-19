// What's in the freezer that you already cooked. A meal you don't have to think about.
import { Snowflake, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatDay, relativeDayLabel, todayISO } from '../../domain/dates';
import { daysBetween } from '../../domain/dates';
import type { FreezerMeal } from '../../domain/leftovers';
import type { Slot } from '../../domain/types';
import { planFromFreezer, removeFromFreezer } from '../../services/leftovers';
import { EmptyState, PageHeader, RecipeThumb, Sheet } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';

const SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner'];

export function Freezer() {
  const { freezer, recipeById, today } = useAppData();
  const toast = useToast();
  const [planning, setPlanning] = useState<FreezerMeal | null>(null);
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<Slot>('dinner');

  const sorted = [...freezer].sort((a, b) => a.eatBy.localeCompare(b.eatBy));
  const portions = freezer.reduce((n, m) => n + m.portions, 0);

  return (
    <>
      <PageHeader
        title="In the freezer"
        subtitle={portions ? `${portions} portion${portions === 1 ? '' : 's'} ready to go` : undefined}
        back
      />
      <div className="space-y-3 px-4 pb-8">
        {sorted.length === 0 ? (
          <EmptyState
            emoji="❄️"
            title="Nothing frozen yet"
            body="Cooked more than you needed? Open the meal on your plan and choose “Freeze extra portions”."
            action={<Link to="/plan" className="btn btn-primary">Go to the plan</Link>}
          />
        ) : (
          <ul className="card divide-y divide-stone-100">
            {sorted.map((m) => {
              const r = recipeById.get(m.recipeId);
              const left = daysBetween(today, m.eatBy);
              return (
                <li key={m.id} className="flex items-center gap-3 p-3">
                  {r && <RecipeThumb recipe={r} className="h-12 w-12 text-2xl" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r?.title ?? 'A recipe you deleted'}</div>
                    <div className="text-xs text-stone-500">
                      {m.portions} × {m.servingsEach} serving{m.servingsEach === 1 ? '' : 's'}
                      {' · '}
                      <span className={left <= 14 ? 'font-semibold text-amber-600' : ''}>
                        best by {formatDay(m.eatBy, 'MMM d')}
                      </span>
                      {m.note ? ` · ${m.note}` : ''}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary px-3 py-1.5 text-sm"
                    onClick={() => { setPlanning(m); setDate(today); setSlot('dinner'); }}
                  >
                    Plan it
                  </button>
                  <button
                    className="icon-btn text-red-600"
                    aria-label="Remove one portion"
                    onClick={() => void removeFromFreezer(m.id).then(() => toast('Out of the freezer'))}
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {sorted.length > 0 && (
          <p className="px-1 text-xs text-stone-500">
            <Snowflake size={12} className="mr-1 inline" />
            Best-by dates are three months from the day you froze it — a guide, not a rule.
          </p>
        )}
      </div>

      {planning && (
        <Sheet
          open
          onClose={() => setPlanning(null)}
          title={`Thaw ${recipeById.get(planning.recipeId)?.title ?? 'this'}`}
          footer={
            <button
              className="btn btn-primary w-full"
              onClick={async () => {
                await planFromFreezer(planning.id, date, slot);
                toast(`On the plan for ${relativeDayLabel(date, todayISO())}`);
                setPlanning(null);
              }}
            >
              Put it on the plan
            </button>
          }
        >
          <label className="label" htmlFor="freezer-date">Day</label>
          <input id="freezer-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="label pt-3">Meal</div>
          <div className="flex gap-2">
            {SLOTS.map((s) => (
              <button key={s} className={`chip flex-1 capitalize ${s === slot ? 'chip-on' : ''}`} onClick={() => setSlot(s)}>
                {s}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-stone-500">
            It goes on as a leftover night, so the shopping list won't ask you to buy the ingredients again.
          </p>
        </Sheet>
      )}
    </>
  );
}
