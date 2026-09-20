// Feature 1: what the week actually adds up to. Estimated, never precise — the point is to
// notice a week of 2,900-calorie dinners, not to count to the gram.
import { useState } from 'react';
import { Link } from 'react-router';
import { addDaysISO, formatDay, startOfWeekISO } from '../../domain/dates';
import { dayNutrition, recipeNutrition, roundN, verdict, type GoalVerdict, type Nutrients } from '../../domain/nutrition';
import { updateSettings } from '../../db/settings';
import { PageHeader, Sheet } from '../components';
import { useAppData } from '../data';

const VERDICT_STYLE: Record<GoalVerdict, string> = {
  under: 'text-amber-600',
  'on-track': 'text-brand',
  over: 'text-red-600',
};

export function Nutrition() {
  const { meals, recipeById, ingById, settings, today } = useAppData();
  const [weekStart, setWeekStart] = useState(startOfWeekISO(today, settings.weekStartsOn));
  const [editing, setEditing] = useState(false);
  const goals = settings.nutritionGoals ?? {};

  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const rows = days.map((date) => ({
    date,
    n: dayNutrition(meals.filter((m) => m.date === date), recipeById, ingById),
  }));
  const plannedDays = rows.filter((r) => r.n.meals.length > 0);
  const avg: Nutrients = plannedDays.length
    ? {
        kcal: plannedDays.reduce((s, r) => s + r.n.kcal, 0) / plannedDays.length,
        protein: plannedDays.reduce((s, r) => s + r.n.protein, 0) / plannedDays.length,
        carbs: plannedDays.reduce((s, r) => s + r.n.carbs, 0) / plannedDays.length,
        fat: plannedDays.reduce((s, r) => s + r.n.fat, 0) / plannedDays.length,
      }
    : { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  const max = Math.max(1, ...rows.map((r) => r.n.kcal), goals.kcal ?? 0);

  return (
    <>
      <PageHeader
        title="Nutrition"
        subtitle={`${formatDay(weekStart, 'MMM d')} – ${formatDay(addDaysISO(weekStart, 6), 'MMM d')}`}
        back
        right={
          <button className="px-2 text-sm font-medium text-brand" onClick={() => setEditing(true)}>
            Goals
          </button>
        }
      />
      <div className="space-y-4 px-4 pb-8">
        <div className="flex items-center justify-between">
          <button className="btn btn-secondary px-3 py-1.5 text-sm" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>
            ← Previous
          </button>
          <button className="btn btn-secondary px-3 py-1.5 text-sm" onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>
            Next →
          </button>
        </div>

        <div className="card p-4">
          <div className="section-title pt-0">A typical day this week</div>
          {plannedDays.length === 0 ? (
            <p className="text-sm text-stone-500">Nothing planned this week yet.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 text-center">
              <Stat label="Calories" value={roundN(avg.kcal)} unit="" tone={verdict(avg.kcal, goals.kcal)} />
              <Stat label="Protein" value={roundN(avg.protein)} unit="g" tone={verdict(avg.protein, goals.protein)} />
              <Stat label="Carbs" value={roundN(avg.carbs)} unit="g" tone={verdict(avg.carbs, goals.carbs)} />
              <Stat label="Fat" value={roundN(avg.fat)} unit="g" tone={verdict(avg.fat, goals.fat)} />
            </div>
          )}
          <p className="mt-3 text-xs text-stone-400">
            Estimated from a built-in table of common ingredients. Treat it as a ballpark, not a label.
          </p>
        </div>

        <div className="card p-4">
          <div className="section-title pt-0">Day by day</div>
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.date}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className={r.date === today ? 'font-semibold' : ''}>{formatDay(r.date, 'EEE d MMM')}</span>
                  <span className="tabular-nums text-stone-500">
                    {r.n.meals.length ? `${roundN(r.n.kcal)} cal · ${roundN(r.n.protein)} g protein` : '—'}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${(r.n.kcal / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-4">
          <div className="section-title pt-0">Per serving, by recipe</div>
          <ul className="divide-y divide-stone-100">
            {[...new Set(meals.filter((m) => days.includes(m.date)).map((m) => m.recipeId))].map((id) => {
              const r = recipeById.get(id);
              if (!r) return null;
              const n = recipeNutrition(r, r.baseServings, ingById);
              return (
                <li key={id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <Link to={`/recipes/${id}`} className="min-w-0 flex-1 truncate font-medium">
                    {r.title}
                  </Link>
                  <span className="shrink-0 text-sm tabular-nums text-stone-500">
                    {roundN(n.perServing.kcal)} cal
                    {!n.confident && <span className="ml-1 text-stone-300" title="Several ingredients are estimated">~</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Daily goals">
        <p className="text-sm text-stone-500">Leave a box blank to stop tracking that one. Anything within 10% counts as on target.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
            <label key={k}>
              <span className="label capitalize">{k === 'kcal' ? 'Calories' : k}</span>
              <input
                className="input"
                inputMode="numeric"
                value={goals[k] ?? ''}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  void updateSettings({ nutritionGoals: { ...goals, [k]: e.target.value === '' || !v ? undefined : v } });
                }}
              />
            </label>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 accent-green-700"
            checked={settings.showNutrition !== false}
            onChange={(e) => void updateSettings({ showNutrition: e.target.checked })}
          />
          Show calories on recipe pages
        </label>
      </Sheet>
    </>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: number; unit: string; tone?: GoalVerdict }) {
  return (
    <div>
      <div className={`text-xl font-bold tabular-nums ${tone ? VERDICT_STYLE[tone] : ''}`}>
        {value}
        <span className="text-xs font-medium">{unit}</span>
      </div>
      <div className="text-[11px] text-stone-500">{label}</div>
    </div>
  );
}
