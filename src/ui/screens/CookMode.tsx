// Cook mode: big step-by-step view, tap-to-start timers, screen kept awake,
// then a quick review of what was used so the pantry stays accurate.
import { ChevronLeft, ChevronRight, ListChecks, Timer, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { detectTimerSec } from '../../domain/parse';
import type { LooseLevel } from '../../domain/types';
import { formatQty } from '../../domain/units';
import { tipsByStep } from '../../domain/freshness';
import { renderStep } from '../../domain/steptext';
import { FlipAmount, StorageTip, useRecipeUnits } from '../amounts';
import { cookRecipe, previewCook, undoCook } from '../../services/cook';
import { setLooseLevel } from '../../services/pantry';
import { AmountInput, EmptyState, PageHeader, Segmented, Sheet } from '../components';
import { useAppData } from '../data';
import { entriesFor } from '../../domain/journal';
import { useToast } from '../toast';

interface RunningTimer {
  id: number;
  label: string;
  endsAt: number;
  total: number;
}

function beep() {
  try {
    const ctx = new AudioContext();
    for (const t of [0, 0.4, 0.8]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.3, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    }
  } catch {
    /* audio unavailable */
  }
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function CookMode() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { recipeById, meals, ingById, lots, looseById, settings, journal } = useAppData();
  const recipe = recipeById.get(id);
  const meal = meals.find((m) => m.id === params.get('meal'));
  const servings = meal?.servings ?? Number(params.get('servings') ?? settings.householdSize);

  const [step, setStep] = useState(0);
  const [ingOpen, setIngOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [, setTick] = useState(0);
  const fired = useRef(new Set<number>());
  const units = useRecipeUnits(id, settings.units);

  // keep the screen on
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const req = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        /* not supported */
      }
    };
    void req();
    const onVis = () => {
      if (document.visibilityState === 'visible') void req();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release();
    };
  }, []);

  useEffect(() => {
    if (!timers.length) return;
    const t = window.setInterval(() => {
      setTick((n) => n + 1);
      for (const tm of timers) {
        if (tm.endsAt <= Date.now() && !fired.current.has(tm.id)) {
          fired.current.add(tm.id);
          beep();
        }
      }
    }, 500);
    return () => window.clearInterval(t);
  }, [timers]);

  if (!recipe) {
    return (
      <>
        <PageHeader title="Cook" back />
        <EmptyState emoji="🤷" title="Recipe not found" />
      </>
    );
  }

  const scale = servings / (recipe.baseServings || 1);
  const text = renderStep(recipe.steps[step] ?? '', { scale, system: units.system, recipe, ingById });
  const timerSec = detectTimerSec(text);
  const last = step === recipe.steps.length - 1;
  const stepTips = tipsByStep(recipe, ingById).get(step) ?? [];

  const myNotes = entriesFor(journal, recipe.id);
  return (
    <div className="pt-safe flex min-h-dvh flex-col bg-white">
      <div className="flex h-14 items-center gap-2 px-3">
        <button className="icon-btn" aria-label="Exit cook mode" onClick={() => navigate(-1)}>
          <X size={24} />
        </button>
        <div className="min-w-0 flex-1 truncate text-center font-semibold">{recipe.title}</div>
        <button className="icon-btn" aria-label="Ingredients" onClick={() => setIngOpen(true)}>
          <ListChecks size={22} />
        </button>
      </div>
      <div className="flex gap-1 px-4" aria-hidden>
        {recipe.steps.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-brand' : 'bg-stone-200'}`} />
        ))}
      </div>

      <div className="flex flex-1 flex-col px-6 pt-8">
        {step === 0 && myNotes.length > 0 && (
          <div className="card mb-4 bg-amber-50 p-3 text-sm">
            <b>Last time you said:</b> {myNotes[0].note}
          </div>
        )}
        <div className="text-sm font-semibold text-brand">Step {step + 1} of {recipe.steps.length}</div>
        <p className="mt-3 text-2xl leading-snug font-medium">{text}</p>
        {timerSec && (
          <button
            className="btn btn-secondary mt-6 self-start"
            onClick={() =>
              setTimers((ts) => [...ts, { id: Date.now(), label: `Step ${step + 1}`, endsAt: Date.now() + timerSec * 1000, total: timerSec * 1000 }])
            }
          >
            <Timer size={18} /> Start {mmss(timerSec * 1000)} timer
          </button>
        )}
        {stepTips.length > 0 && (
          <div className="mt-6 space-y-2">
            {stepTips.map((ing) => <StorageTip key={ing.id} ing={ing} />)}
          </div>
        )}
      </div>

      {timers.length > 0 && (
        <div className="space-y-2 px-4 pb-2">
          {timers.map((tm) => {
            const left = tm.endsAt - Date.now();
            const done = left <= 0;
            return (
              <div key={tm.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${done ? 'animate-pulse bg-red-600 text-white' : 'bg-stone-900 text-white'}`}>
                <Timer size={18} />
                <span className="flex-1 text-sm">{tm.label}</span>
                <span className="font-mono text-lg font-semibold tabular-nums">{done ? 'Done!' : mmss(left)}</span>
                <button aria-label="Dismiss timer" onClick={() => setTimers((ts) => ts.filter((x) => x.id !== tm.id))}>
                  <X size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="pb-safe flex gap-3 border-t border-stone-100 px-4 pt-3">
        <button className="btn btn-secondary mb-3 h-14 flex-1" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <ChevronLeft /> Back
        </button>
        {last ? (
          <button className="btn btn-primary mb-3 h-14 flex-[2]" onClick={() => setReviewOpen(true)}>
            Done cooking
          </button>
        ) : (
          <button className="btn btn-primary mb-3 h-14 flex-[2]" onClick={() => setStep(step + 1)}>
            Next <ChevronRight />
          </button>
        )}
      </div>

      <Sheet open={ingOpen} onClose={() => setIngOpen(false)} title={`Ingredients · serves ${servings}`}>
        <ul className="divide-y divide-stone-100">
          {recipe.ingredients.map((ri, i) => (
            <li key={i} className="py-2.5">
              <FlipAmount amount={units.line(ri, i, scale, ingById.get(ri.ingredientId))} /> {ingById.get(ri.ingredientId)?.name.toLowerCase()}
              {ri.prep && <span className="text-stone-500">, {ri.prep}</span>}
            </li>
          ))}
        </ul>
      </Sheet>

      {reviewOpen && (
        <ReviewSheet
          onClose={() => setReviewOpen(false)}
          lines={previewCook(recipe, servings, ingById, lots)}
          looseLevels={new Map([...looseById].map(([k, v]) => [k, v.level]))}
          onConfirm={async (amounts, looseChanges) => {
            const logId = await cookRecipe({ recipeId: recipe.id, servings, plannedMealId: meal?.id, amounts });
            for (const [ingId, level] of looseChanges) await setLooseLevel(ingId, level);
            navigate('/', { replace: true });
            toast('Enjoy! Pantry updated.', { label: 'Undo', run: () => undoCook(logId) });
          }}
        />
      )}
    </div>
  );
}

function ReviewSheet(props: {
  onClose: () => void;
  lines: ReturnType<typeof previewCook>;
  looseLevels: Map<string, LooseLevel>;
  onConfirm: (amounts: Record<string, number>, loose: Map<string, LooseLevel>) => Promise<void>;
}) {
  const { ingById, settings } = useAppData();
  const exact = props.lines.filter((l) => !l.loose);
  const loose = props.lines.filter((l) => l.loose);
  const [amounts, setAmounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(exact.map((l) => [l.ingredientId, Math.round(l.need * 1000) / 1000])),
  );
  const [levels, setLevels] = useState<Map<string, LooseLevel>>(() => new Map());
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const sorted = useMemo(() => [...exact].sort((a, b) => ingById.get(a.ingredientId)!.name.localeCompare(ingById.get(b.ingredientId)!.name)), [exact, ingById]);

  return (
    <Sheet
      open
      onClose={props.onClose}
      title="What did you use?"
      footer={
        <button
          className="btn btn-primary w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await props.onConfirm(amounts, levels);
            } finally {
              setBusy(false);
            }
          }}
        >
          Update pantry
        </button>
      }
    >
      <p className="mb-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
        🥡 <b>Leftovers:</b> cool them and get them into a sealed container in the fridge within 2 hours. They keep 3–4 days — or freeze
        portions for up to 3 months.
      </p>
      <p className="mb-2 text-sm text-stone-500">We'll take these amounts out of your pantry. Tap one to change it.</p>
      <ul className="divide-y divide-stone-100">
        {sorted.map((l) => {
          const ing = ingById.get(l.ingredientId)!;
          const amt = amounts[l.ingredientId] ?? 0;
          return (
            <li key={l.ingredientId} className="py-2.5">
              <button className="flex w-full items-center gap-2 text-left" onClick={() => setEditing(editing === ing.id ? null : ing.id)}>
                <span className="flex-1">{ing.name}</span>
                <span className="font-semibold">{amt > 0 ? formatQty(amt, ing, settings.units) : 'none'}</span>
              </button>
              {l.have < l.need * 0.97 && <div className="text-xs text-amber-700">Pantry only showed {l.have > 0 ? formatQty(l.have, ing, settings.units) : 'none'}</div>}
              {editing === ing.id && (
                <div className="mt-2">
                  <AmountInput ing={ing} value={amt} onChange={(v) => setAmounts((a) => ({ ...a, [ing.id]: v }))} autoFocus />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {loose.length > 0 && (
        <>
          <h3 className="section-title">Spices & staples — running low?</h3>
          <ul className="space-y-2">
            {loose.map((l) => {
              const ing = ingById.get(l.ingredientId)!;
              const level = levels.get(ing.id) ?? props.looseLevels.get(ing.id) ?? 'plenty';
              return (
                <li key={ing.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm">{ing.name}</span>
                  <div className="w-48">
                    <Segmented<LooseLevel>
                      value={level}
                      options={[{ value: 'plenty', label: 'OK' }, { value: 'low', label: 'Low' }, { value: 'out', label: 'Out' }]}
                      onChange={(v) => setLevels((m) => new Map(m).set(ing.id, v))}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Sheet>
  );
}
