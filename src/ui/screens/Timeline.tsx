// Working backwards from when you want to eat. Two or three dishes, one pair of hands.
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatDay } from '../../domain/dates';
import { buildTimeline, formatClock, parseClock } from '../../domain/mealtimeline';
import { updateSettings } from '../../db/settings';
import { EmptyState, PageHeader } from '../components';
import { useAppData } from '../data';

const DOT: Record<string, string> = { prep: 'bg-amber-400', cook: 'bg-orange-500', serve: 'bg-brand' };

export function Timeline() {
  const { date } = useParams();
  const { meals, recipeById, today, settings } = useAppData();
  const day = date ?? today;
  const [serve, setServe] = useState(settings.serveTime ?? '18:30');

  const dishes = useMemo(
    () =>
      meals
        .filter((m) => m.date === day && m.status !== 'skipped' && !m.leftoverOf)
        .map((m) => recipeById.get(m.recipeId))
        .filter((r) => !!r),
    [meals, recipeById, day],
  );

  const timeline = useMemo(() => buildTimeline(dishes, parseClock(serve)), [dishes, serve]);

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
