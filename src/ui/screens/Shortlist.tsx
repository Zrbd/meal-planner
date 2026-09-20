// Feature 19: the cook-next queue — the pile of "yeah, soon" that sits between browsing and
// committing to a date.
import { ArrowDown, ArrowUp, CalendarPlus, X } from 'lucide-react';
import { Link } from 'react-router';
import { todayISO } from '../../domain/dates';
import { pruneScheduled } from '../../domain/shortlist';
import { addMeal } from '../../services/plan';
import { shortlistClear, shortlistMove, shortlistRemove } from '../../services/shortlist';
import { CoverageBadge, EmptyState, PageHeader, RecipeThumb, totalTime } from '../components';
import { useAppData } from '../data';
import { useCoverage } from '../hooks';
import { useToast } from '../toast';

export function Shortlist() {
  const { shortlist, recipeById, meals, settings } = useAppData();
  const coverage = useCoverage();
  const toast = useToast();
  const today = todayISO();

  // Anything already on the plan is no longer "soon" — the list stays a to-do, not a second week view.
  const list = pruneScheduled(shortlist, meals, today);

  return (
    <>
      <PageHeader
        title="Cook next"
        subtitle={list.length ? `${list.length} waiting` : undefined}
        back
        right={
          list.length > 0 ? (
            <button className="px-2 text-sm text-stone-500" onClick={() => void shortlistClear()}>
              Clear
            </button>
          ) : undefined
        }
      />
      <div className="space-y-3 px-4 pb-8">
        {list.length === 0 ? (
          <EmptyState
            emoji="📝"
            title="Nothing queued"
            body="Tap “Cook next” on any recipe to park it here. The planner offers these first when it fills a week."
            action={<Link to="/recipes" className="btn btn-primary">Browse recipes</Link>}
          />
        ) : (
          <ul className="card divide-y divide-stone-100">
            {list.map((e, i) => {
              const r = recipeById.get(e.recipeId);
              if (!r) return null;
              return (
                <li key={e.recipeId} className="flex items-center gap-3 p-3">
                  <Link to={`/recipes/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <RecipeThumb recipe={r} className="h-12 w-12 text-2xl" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.title}</div>
                      <div className="truncate text-xs text-stone-500">
                        {totalTime(r)} min
                        {e.note ? ` · ${e.note}` : ''}
                      </div>
                      {coverage.get(r.id) && <CoverageBadge coverage={coverage.get(r.id)!} />}
                    </div>
                  </Link>
                  <div className="flex flex-col">
                    <button className="icon-btn h-7 w-7" aria-label="Move up" disabled={i === 0} onClick={() => void shortlistMove(i, i - 1)}>
                      <ArrowUp size={16} />
                    </button>
                    <button className="icon-btn h-7 w-7" aria-label="Move down" disabled={i === list.length - 1} onClick={() => void shortlistMove(i, i + 1)}>
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <button
                    className="icon-btn"
                    aria-label="Plan for tonight"
                    onClick={async () => {
                      await addMeal(r.id, today, 'dinner', settings.householdSize);
                      toast(`${r.title} planned for tonight`);
                    }}
                  >
                    <CalendarPlus size={20} />
                  </button>
                  <button className="icon-btn" aria-label="Remove" onClick={() => void shortlistRemove(r.id)}>
                    <X size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
