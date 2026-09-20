// Working backwards from when you want to eat. Two or three dishes, one pair of hands.
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatDay } from '../../domain/dates';
import { buildTimeline, formatClock, parseClock } from '../../domain/mealtimeline';
import { updateSettings } from '../../db/settings';
import { EmptyState, PageHeader } from '../components';
import { useAppData } from '../data';
import { cookName, imbalance, splitTasks, type SousTask } from '../../domain/sous';
import { Users } from 'lucide-react';

const DOT: Record<string, string> = { prep: 'bg-amber-400', cook: 'bg-orange-500', serve: 'bg-brand' };

export function Timeline() {
  const { date } = useParams();
  const { meals, recipeById, today, settings } = useAppData();
  const day = date ?? today;
  const [serve, setServe] = useState(settings.serveTime ?? '18:30');
  // Feature 14: two pairs of hands. Off by default — a solo cook does not want a lane chart.
  const [cooks, setCooks] = useState(1);

  const dishes = useMemo(
    () =>
      meals
        .filter((m) => m.date === day && m.status !== 'skipped' && !m.leftoverOf)
        .map((m) => recipeById.get(m.recipeId))
        .filter((r) => !!r),
    [meals, recipeById, day],
  );

  const timeline = useMemo(() => buildTimeline(dishes, parseClock(serve)), [dishes, serve]);

  const sous = useMemo(() => {
    const tasks: SousTask[] = timeline.events
      .filter((e) => e.kind !== 'serve')
      .map((e, i) => ({
        id: `${e.recipeId}-${i}`,
        label: e.text,
        startsAt: timeline.serveAt - e.at,
        minutes: e.kind === 'prep' ? 8 : 15,
        passive: e.kind === 'cook',
        recipeId: e.recipeId,
      }));
    return splitTasks(tasks, cooks);
  }, [timeline, cooks]);

  return (
    <>
      <PageHeader title="Dinner timeline" subtitle={formatDay(day, 'EEEE, MMM d')} back="/plan" />
      <div className="space-y-4 px-4 pb-8">
        {dishes.length === 0 ? (
          <EmptyState emoji="⏱️" title="Nothing cooking that day" body="Plan a meal and this works out when to start each dish." action={<Link to="/plan" className="btn btn-primary">Open the plan</Link>} />
        ) : (
          <>
            <div className="card flex items-center justify-between p-3">
              <label className="font-medium" htmlFor="serve-at">Sit down to eat at</label>
              <input
                id="serve-at"
                type="time"
                className="input w-32 text-right"
                value={serve}
                onChange={(e) => {
                  setServe(e.target.value);
                  void updateSettings({ serveTime: e.target.value });
                }}
              />
            </div>

            <p className="px-1 text-sm text-stone-500">
              Start at <strong className="text-stone-700">{formatClock(timeline.startAt)}</strong> and everything lands together at {formatClock(timeline.serveAt)}.
            </p>

            {timeline.conflicts.length > 0 && (
              <div className="card border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-medium"><AlertTriangle size={16} /> Two things at once</div>
                <ul className="mt-1 list-disc pl-5">
                  {timeline.conflicts.map((c, i) => (
                    <li key={i}>{formatClock(c.at)} — {c.titles.join(' and ')} both want prep. Chop one of them earlier.</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-medium"><Users size={18} /> How many of you are cooking?</span>
                <div className="flex gap-1">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      className={`chip ${cooks === n ? 'bg-stone-900 font-semibold text-white' : ''}`}
                      onClick={() => setCooks(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {cooks > 1 && (
              <div className="card p-4">
                <div className="section-title pt-0">Who does what</div>
                <div className="space-y-3">
                  {sous.lanes.map((lane, i) => (
                    <div key={i}>
                      <div className="flex items-baseline justify-between">
                        <span className="font-semibold">{cookName(i, settings.cookNames)}</span>
                        <span className="text-xs text-stone-500">{Math.round(sous.load[i])} min hands-on</span>
                      </div>
                      <ul className="mt-1 space-y-1">
                        {lane.map((a) => (
                          <li key={a.task.id} className="flex gap-2 text-sm">
                            <span className="w-14 shrink-0 tabular-nums text-stone-400">
                              {formatClock(timeline.serveAt - a.task.startsAt)}
                            </span>
                            <span className={a.task.passive ? 'text-stone-500' : ''}>{a.task.label}</span>
                          </li>
                        ))}
                        {lane.length === 0 && <li className="text-sm text-stone-400">Nothing yet — pour the wine.</li>}
                      </ul>
                    </div>
                  ))}
                </div>
                {sous.unassigned.length > 0 && (
                  <p className="mt-3 text-sm text-amber-700">
                    {sous.unassigned.length} job{sous.unassigned.length === 1 ? '' : 's'} overlap everything else — whoever is free
                    grabs {sous.unassigned.length === 1 ? 'it' : 'them'}.
                  </p>
                )}
                {imbalance(sous) > 0.4 && (
                  <p className="mt-2 text-xs text-stone-500">
                    This split is lopsided; the dishes simply aren't divisible any more evenly.
                  </p>
                )}
              </div>
            )}

            <ol className="card divide-y divide-stone-100">
              {timeline.events.map((e, i) => (
                <li key={i} className="flex items-start gap-3 p-3">
                  <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">{formatClock(e.at)}</span>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[e.kind]}`} />
                  <span className={`text-sm ${e.kind === 'serve' ? 'font-semibold' : ''}`}>{e.text}</span>
                </li>
              ))}
            </ol>

            <p className="px-1 text-xs text-stone-500">
              Times come from each recipe's own prep and cook minutes, longest dish first.
            </p>
          </>
        )}
      </div>
    </>
  );
}
