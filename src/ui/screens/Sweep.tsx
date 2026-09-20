// Feature 18: the guided fridge sweep. Alerts tell you something expired; this walks the pile
// one item at a time, asks the only three questions that matter, and logs what went in the bin.
import { Check, ChefHat, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { buildSweep, describeSummary, suggestedExtension, summarize, type SweepDecision, type SweepVerdict } from '../../domain/sweep';
import { applySweep } from '../../services/sweep';
import { shortlistAdd } from '../../services/shortlist';
import { EmptyState, PageHeader } from '../components';
import { useAppData } from '../data';
import { useCoverage } from '../hooks';
import { useToast } from '../toast';

export function Sweep() {
  const { lots, ingById, today, recipes } = useAppData();
  const coverage = useCoverage();
  const toast = useToast();
  const navigate = useNavigate();

  const items = useMemo(() => buildSweep(lots, ingById, today, 3), [lots, ingById, today]);
  const [decisions, setDecisions] = useState<Map<string, SweepDecision>>(new Map());
  const [index, setIndex] = useState(0);

  const item = items[index];
  const done = index >= items.length;
  const summary = summarize(items, decisions);

  const decide = (verdict: SweepVerdict) => {
    if (!item) return;
    const next = new Map(decisions);
    next.set(item.lot.id, {
      lotId: item.lot.id,
      verdict,
      extendDays: verdict === 'keep' ? suggestedExtension(item.ing, item.lot) : undefined,
    });
    setDecisions(next);
    if (verdict === 'use-now') {
      // Find something that actually uses it, so "use it now" has an answer attached.
      const pick = recipes.find(
        (r) => r.ingredients.some((l) => l.ingredientId === item.lot.ingredientId) && (coverage.get(r.id)?.ratio ?? 0) >= 0.7,
      );
      if (pick) void shortlistAdd(pick.id, `uses up the ${item.ing?.name.toLowerCase() ?? 'leftovers'}`);
    }
    setIndex(index + 1);
  };

  if (!items.length) {
    return (
      <>
        <PageHeader title="Fridge sweep" back />
        <div className="px-4">
          <EmptyState emoji="✨" title="Nothing to sweep" body="Nothing is expiring in the next few days. Come back after the next shop." />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Fridge sweep" subtitle={done ? describeSummary(summary) : `${index + 1} of ${items.length}`} back />
      <div className="space-y-4 px-4 pb-8">
        <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(index / items.length) * 100}%` }} />
        </div>

        {!done && item && (
          <>
            <div className="card p-6 text-center">
              <div className="text-5xl">{item.urgency === 'expired' ? '⚠️' : '⏳'}</div>
              <div className="mt-3 text-xl font-bold">{item.label}</div>
              <div className={`mt-1 text-sm font-medium ${item.urgency === 'expired' ? 'text-red-600' : 'text-amber-600'}`}>
                {item.daysLeft < 0
                  ? `${-item.daysLeft} day${item.daysLeft === -1 ? '' : 's'} past its date`
                  : item.daysLeft === 0
                    ? 'Date is today'
                    : `${item.daysLeft} day${item.daysLeft === 1 ? '' : 's'} left`}
              </div>
              <div className="mt-1 text-xs text-stone-400 capitalize">{item.lot.location}</div>
              <p className="mt-4 text-sm text-stone-500">Have a look and a smell. What is the verdict?</p>
            </div>

            <div className="space-y-2">
              <button className="btn btn-secondary w-full py-3.5" onClick={() => decide('keep')}>
                <Check size={20} /> Still fine — give it {suggestedExtension(item.ing, item.lot)} more days
              </button>
              <button className="btn btn-secondary w-full py-3.5" onClick={() => decide('use-now')}>
                <ChefHat size={20} /> Use it in the next day or two
              </button>
              <button className="btn btn-danger w-full py-3.5" onClick={() => decide('toss')}>
                <Trash2 size={20} /> It's gone
              </button>
            </div>
            <button className="w-full py-2 text-sm text-stone-400" onClick={() => setIndex(index + 1)}>
              Skip this one
            </button>
          </>
        )}

        {done && (
          <div className="space-y-3">
            <div className="card p-6 text-center">
              <div className="text-5xl">🧹</div>
              <div className="mt-3 text-lg font-bold">{describeSummary(summary)}</div>
              {summary.tossed > 0 && (
                <p className="mt-2 text-sm text-stone-500">
                  What you binned goes into the waste report, so next month's shopping list can be a bit smaller.
                </p>
              )}
            </div>
            <button
              className="btn btn-primary w-full"
              onClick={async () => {
                const outcome = await applySweep([...decisions.values()], today);
                toast(`${outcome.kept} kept, ${outcome.tossed} binned`);
                navigate('/pantry');
              }}
            >
              Save the sweep
            </button>
            {summary.useNow > 0 && (
              <Link to="/next" className="btn btn-secondary w-full">
                See what to cook with them
              </Link>
            )}
            <button className="w-full py-2 text-sm text-stone-400" onClick={() => { setIndex(0); setDecisions(new Map()); }}>
              Start over
            </button>
          </div>
        )}
      </div>
    </>
  );
}
