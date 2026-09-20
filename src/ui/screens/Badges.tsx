// Feature 13: kitchen badges. Deliberately about habits — cooking what you planned, not binning
// food, getting out of the same four dinners — rather than points for opening the app.
import { toISODate } from '../../domain/dates';
import { badges, earnedCount, nextBadge } from '../../domain/badges';
import { streaks } from '../../domain/stats';
import { PageHeader } from '../components';
import { useAppData } from '../data';

export function Badges() {
  const { cookLogs, meals, recipeById, trips, txns, today } = useAppData();
  const cookDays = cookLogs.map((l) => toISODate(new Date(l.at)));
  const { best } = streaks(cookDays, today);

  const list = badges({ cookLogs, meals, recipeById, trips, txns, bestStreak: best });
  const earned = earnedCount(list);
  const next = nextBadge(list);

  return (
    <>
      <PageHeader title="Kitchen badges" subtitle={`${earned} of ${list.length} earned`} back />
      <div className="space-y-4 px-4 pb-8">
        {next && (
          <div className="card p-4">
            <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Closest</div>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-3xl grayscale">{next.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{next.name}</div>
                <div className="text-xs text-stone-500">{next.goal}</div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((next.progress / next.target) * 100)}%` }} />
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums text-stone-500">
                {next.progress}/{next.target}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {list.map((b) => (
            <div key={b.id} className={`card p-4 ${b.earned ? '' : 'opacity-70'}`}>
              <div className={`text-3xl ${b.earned ? '' : 'grayscale'}`}>{b.emoji}</div>
              <div className="mt-1 leading-tight font-semibold">{b.name}</div>
              <div className="mt-0.5 text-xs text-stone-500">{b.goal}</div>
              {b.earned ? (
                <div className="mt-2 text-xs font-semibold text-brand">Earned</div>
              ) : (
                <div className="mt-2 text-xs tabular-nums text-stone-400">
                  {Math.min(b.progress, b.target)} / {b.target}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
