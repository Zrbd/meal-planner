// Feature 5: dinner roulette. For the night when nobody will choose.
import { Dices, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { todayISO } from '../../domain/dates';
import { rouletteWheel, spin, type RouletteEntry } from '../../domain/roulette';
import { addMeal } from '../../services/plan';
import { EmptyState, PageHeader, RecipeThumb, totalTime } from '../components';
import { useAppData } from '../data';
import { useCoverage } from '../hooks';
import { useToast } from '../toast';

const LIMITS = [
  { label: 'Any time', value: 0 },
  { label: 'Under 30 min', value: 30 },
  { label: 'Under 45 min', value: 45 },
  { label: 'Under an hour', value: 60 },
];

export function Roulette() {
  const { recipes, cookLogs, meals, now, settings } = useAppData();
  const coverage = useCoverage();
  const toast = useToast();
  const navigate = useNavigate();
  const today = todayISO();

  const [maxMinutes, setMaxMinutes] = useState(0);
  const [onlyCanMake, setOnlyCanMake] = useState(false);
  const [result, setResult] = useState<RouletteEntry | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);

  const pool = onlyCanMake
    ? new Set([...coverage.entries()].filter(([, c]) => c.canMake).map(([id]) => id))
    : undefined;
  const input = {
    recipes, coverage, cookLogs, meals, today, now,
    pool, maxMinutes: maxMinutes || undefined,
  };
  const eligible = rouletteWheel(input).length;

  const pull = () => {
    setSpinning(true);
    // A beat of suspense; without it the answer appears before your thumb has left the button.
    window.setTimeout(() => {
      const picked = spin({ ...input, seed: Math.floor(Math.random() * 2 ** 31) });
      setResult(picked ?? null);
      if (picked) setSeen((s) => [picked.recipe.id, ...s].slice(0, 10));
      setSpinning(false);
    }, 550);
  };

  return (
    <>
      <PageHeader title="Dinner roulette" subtitle={`${eligible} recipe${eligible === 1 ? '' : 's'} in the wheel`} back />
      <div className="space-y-4 px-4 pb-8">
        <div className="card space-y-3 p-4">
          <div>
            <div className="label">How long have you got?</div>
            <div className="flex flex-wrap gap-2">
              {LIMITS.map((l) => (
                <button
                  key={l.value}
                  className={`chip ${maxMinutes === l.value ? 'chip-on' : ''}`}
                  onClick={() => setMaxMinutes(l.value)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-green-700" checked={onlyCanMake} onChange={(e) => setOnlyCanMake(e.target.checked)} />
            Only things I can cook right now
          </label>
        </div>

        <button className="btn btn-primary w-full py-4 text-lg" onClick={pull} disabled={spinning || eligible === 0}>
          {spinning ? <RotateCw className="animate-spin" size={22} /> : <Dices size={22} />}
          {spinning ? 'Spinning…' : result ? 'Spin again' : 'Spin'}
        </button>

        {eligible === 0 && (
          <EmptyState
            emoji="🎲"
            title="Nothing to spin"
            body="Every recipe is filtered out, already planned, or over your time limit. Loosen the filters and try again."
          />
        )}

        {result && !spinning && (
          <div className="card overflow-hidden">
            <Link to={`/recipes/${result.recipe.id}`} className="flex items-center gap-3 p-4">
              <RecipeThumb recipe={result.recipe} className="h-20 w-20 text-4xl" />
              <div className="min-w-0">
                <div className="text-lg leading-tight font-bold">{result.recipe.title}</div>
                <div className="text-xs text-stone-500">
                  {totalTime(result.recipe)} min
                  {result.recipe.cuisine ? ` · ${result.recipe.cuisine}` : ''}
                </div>
                {result.reasons.length > 0 && (
                  <div className="mt-1 text-xs text-brand">{result.reasons.join(' · ')}</div>
                )}
              </div>
            </Link>
            <div className="flex gap-2 border-t border-stone-100 p-3">
              <button
                className="btn btn-secondary flex-1"
                onClick={async () => {
                  await addMeal(result.recipe.id, today, 'dinner', settings.householdSize);
                  toast(`${result.recipe.title} added to tonight`);
                  navigate('/plan');
                }}
              >
                Cook it tonight
              </button>
              <Link to={`/recipes/${result.recipe.id}/cook`} className="btn btn-primary flex-1">
                Start cooking
              </Link>
            </div>
          </div>
        )}

        {seen.length > 1 && (
          <div>
            <div className="section-title">Already spun</div>
            <div className="flex flex-wrap gap-2">
              {seen.slice(1).map((id) => {
                const r = recipes.find((x) => x.id === id);
                return r ? (
                  <Link key={id} to={`/recipes/${id}`} className="chip">
                    {r.title}
                  </Link>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
