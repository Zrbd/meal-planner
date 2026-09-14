// Prep checklist: every cut the coming meals need, grouped by ingredient, with where each portion goes
// (fridge, or freezer and when to thaw it), plus thawing/marinating reminders. Checks are remembered.
import { Check, Refrigerator, Snowflake, Timer, UtensilsCrossed } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { addDaysISO, formatDay, relativeDayLabel } from '../../domain/dates';
import { formatClock } from '../../domain/prep';
import { weekPrep, type CutTask } from '../../domain/prepweek';
import { formatQty } from '../../domain/units';
import { setPrepChecked } from '../../services/prep';
import { EmptyState, PageHeader, Segmented } from '../components';
import { useAppData } from '../data';
import { usePrepTimeline } from '../hooks';

function Box({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      aria-label={label}
      aria-pressed={checked}
      onClick={onToggle}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${checked ? 'border-brand bg-brand text-white' : 'border-stone-300 bg-white'}`}
    >
      {checked && <Check size={16} strokeWidth={3} />}
    </button>
  );
}

export function Prep() {
  const { meals, recipeById, ingById, today, settings, prepChecks } = useAppData();
  const [days, setDays] = useState<'3' | '7'>('7');
  const to = addDaysISO(today, Number(days) - 1);
  const groups = useMemo(
    () => weekPrep({ meals, recipesById: recipeById, ingById, from: today, to }),
    [meals, recipeById, ingById, today, to],
  );
  const timeline = usePrepTimeline();

  const toggle = (ids: string[], on: boolean) => void setPrepChecked(ids, on);
  const where = (t: CutTask) =>
    t.storage === 'freezer' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">
        <Snowflake size={12} /> Freeze · thaw {relativeDayLabel(t.thawOn!, today).toLowerCase()} night
      </span>
    ) : t.storage === 'fridge' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-800">
        <Refrigerator size={12} /> Fridge
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
        <UtensilsCrossed size={12} /> Cut on the day
      </span>
    );

  const ahead = groups.map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.storage !== 'day-of') })).filter((g) => g.tasks.length);
  const dayOf = groups.flatMap((g) => g.tasks.filter((t) => t.storage === 'day-of'));
  const doneCount = ahead.reduce((n, g) => n + g.tasks.filter((t) => prepChecks.has(t.id)).length, 0);
  const totalCount = ahead.reduce((n, g) => n + g.tasks.length, 0);

  return (
    <>
      <PageHeader title="Prep list" subtitle={totalCount ? `${doneCount} of ${totalCount} done` : 'Batch your knife work'} back />
      <div className="space-y-4 px-4">
        <Segmented value={days} onChange={setDays} options={[{ value: '3', label: 'Next 3 days' }, { value: '7', label: 'Next 7 days' }]} />

        {timeline.length > 0 && (
          <section>
            <h2 className="px-1 pb-1.5 font-semibold">Start ahead</h2>
            <ul className="card divide-y divide-stone-100">
              {timeline.map((it) => {
                const on = prepChecks.has(it.id);
                return (
                  <li key={it.id} className="flex items-center gap-3 p-3">
                    <Box checked={on} onToggle={() => toggle([it.id], !on)} label={it.title} />
                    <div className={`min-w-0 flex-1 text-sm ${on ? 'text-stone-400 line-through' : ''}`}>
                      <div className="font-medium">{it.title}</div>
                      <div className="text-xs text-stone-500">
                        <Timer size={11} className="-mt-0.5 inline" /> {relativeDayLabel(it.date, today)} by {formatClock(it.at)}
                        {it.recipeId && recipeById.get(it.recipeId) && <> · for {recipeById.get(it.recipeId)!.title}</>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {ahead.length === 0 && timeline.length === 0 && (
          <EmptyState
            emoji="🔪"
            title="Nothing to prep yet"
            body="Plan some meals and this fills in with everything to chop, slice and portion ahead — and what goes in the freezer."
            action={<Link to="/plan" className="btn btn-primary">Plan meals</Link>}
          />
        )}

        {ahead.length > 0 && (
          <section>
            <h2 className="px-1 font-semibold">Knife prep</h2>
            <p className="px-1 pb-1.5 text-xs text-stone-500">
              Do it all in one go. Portions for meals more than a couple of days out go in the freezer, labeled.
            </p>
            <div className="space-y-2">
              {ahead.map((g) => {
                const ing = ingById.get(g.ingredientId)!;
                const ids = g.tasks.map((t) => t.id);
                const all = ids.every((id) => prepChecks.has(id));
                return (
                  <div key={g.ingredientId} className="card p-3">
                    <div className="flex items-center gap-3">
                      <Box checked={all} onToggle={() => toggle(ids, !all)} label={`All ${ing.name}`} />
                      <div className={`flex-1 font-semibold ${all ? 'text-stone-400 line-through' : ''}`}>{ing.name}</div>
                      {g.total > 0 && <div className="text-sm text-stone-500">{formatQty(g.total, ing, settings.units)} total</div>}
                    </div>
                    <ul className="mt-2 space-y-2 pl-9">
                      {g.tasks.map((t) => {
                        const on = prepChecks.has(t.id);
                        const r = recipeById.get(t.recipeId);
                        return (
                          <li key={t.id} className="flex items-start gap-2 text-sm">
                            <Box checked={on} onToggle={() => toggle([t.id], !on)} label={`${t.cut} for ${r?.title ?? ''}`} />
                            <div className={`min-w-0 flex-1 ${on ? 'text-stone-400 line-through' : ''}`}>
                              <div>
                                {t.qty > 0 && <b>{formatQty(t.qty, ing, settings.units)} </b>}
                                {t.cut}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                                <Link to={`/recipes/${t.recipeId}`} className="underline decoration-dotted">{r?.title}</Link>
                                <span className="capitalize">· {relativeDayLabel(t.date, today) === formatDay(t.date) ? formatDay(t.date, 'EEE') : relativeDayLabel(t.date, today)} {t.slot}</span>
                                {where(t)}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {dayOf.length > 0 && (
          <section>
            <h2 className="px-1 pb-1.5 font-semibold">Leave for the day</h2>
            <ul className="card divide-y divide-stone-100 text-sm">
              {dayOf.map((t) => {
                const ing = ingById.get(t.ingredientId)!;
                return (
                  <li key={t.id} className="p-3">
                    {t.qty > 0 && <b>{formatQty(t.qty, ing, settings.units)} </b>}
                    {ing.name.toLowerCase()}, {t.cut}
                    <div className="text-xs text-stone-500">
                      {recipeById.get(t.recipeId)?.title} · {relativeDayLabel(t.date, today)} — browns or wilts if cut ahead
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
