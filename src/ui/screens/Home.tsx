import { AlertTriangle, BookPlus, CalendarDays, ChefHat, ChevronRight, CircleOff, Clock, Hourglass, Settings, ShoppingCart, Snowflake, Timer, Trash2, TrendingDown } from 'lucide-react';
import { Link } from 'react-router';
import { addDaysISO, formatDay, nextShoppingDay, relativeDayLabel, toISODate } from '../../domain/dates';
import type { AlertKind } from '../../domain/forecast';
import { formatClock, type TimelineItem } from '../../domain/prep';
import { SLOT_ORDER } from '../../domain/stock';
import type { PlannedMeal } from '../../domain/types';
import { EmptyState, PageHeader, RecipeThumb } from '../components';
import { useAppData } from '../data';
import { useAlerts, useClock, useCoverage, usePrepTimeline } from '../hooks';

const DAY = 86_400_000;

const ALERT_STYLE: Record<AlertKind, { icon: typeof Clock; tone: string }> = {
  expired: { icon: Trash2, tone: 'text-red-600 bg-red-50' },
  thaw: { icon: Snowflake, tone: 'text-sky-600 bg-sky-50' },
  prep: { icon: ChefHat, tone: 'text-violet-600 bg-violet-50' },
  old: { icon: Hourglass, tone: 'text-emerald-700 bg-emerald-50' },
  short: { icon: ShoppingCart, tone: 'text-orange-600 bg-orange-50' },
  out: { icon: CircleOff, tone: 'text-red-600 bg-red-50' },
  expiring: { icon: Clock, tone: 'text-amber-600 bg-amber-50' },
  low: { icon: TrendingDown, tone: 'text-amber-600 bg-amber-50' },
};

const PREP_EMOJI: Record<TimelineItem['kind'], string> = { thaw: '🧊', marinate: '🥣', soak: '💧', rise: '🍞', chill: '❄️', rest: '⏳' };

const bySlot =(a: PlannedMeal, b: PlannedMeal) => a.date.localeCompare(b.date) || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Home() {
  const d = useAppData();
  const allAlerts = useAlerts();
  const coverage = useCoverage();
  const clock = useClock();
  const { today, meals, recipeById, settings } = d;
  // thawing and prep get their own timeline with times, so they don't repeat under "Heads up"
  const timeline = usePrepTimeline().filter((t) => t.cookAt > clock);
  const alerts = timeline.length ? allAlerts.filter((a) => a.kind !== 'thaw' && a.kind !== 'prep') : allAlerts;
  const restoredRecently = !!d.autoRestoredAt && d.now - d.autoRestoredAt < 2 * DAY;

  const todays = meals.filter((m) => m.date === today && m.status !== 'skipped').sort(bySlot);
  const upcoming = meals
    .filter((m) => m.date > today && m.date <= addDaysISO(today, 6) && m.status === 'planned')
    .sort(bySlot)
    .slice(0, 5);
  const shopDay = nextShoppingDay(addDaysISO(today, -1), settings.shoppingDay);
  const needsBackup = (d.lots.length > 0 || meals.length > 0) && (!d.lastBackupAt || d.now - d.lastBackupAt > 14 * DAY);
  const canMake = d.recipes.filter((r) => !r.archived && coverage.get(r.id)?.canMake).length;

  return (
    <>
      <PageHeader
        title={greeting()}
        subtitle={formatDay(today, 'EEEE, MMMM d')}
        right={
          <Link to="/settings" aria-label="Settings" className="icon-btn">
            <Settings size={22} />
          </Link>
        }
      />
      <div className="space-y-2 px-4">
        {restoredRecently && (
          <div className="card border-green-200 bg-green-50 p-3 text-sm text-green-900">
            💾 Your phone had cleared the app's data, so it was brought back from the automatic backup.
          </div>
        )}
        <h2 className="section-title">Today</h2>
        {todays.length === 0 ? (
          <div className="card">
            <EmptyState
              emoji="🍽️"
              title="Nothing planned today"
              body={canMake ? `You have everything for ${canMake} recipe${canMake === 1 ? '' : 's'} right now.` : 'Plan a few meals and we’ll build your shopping list.'}
              action={
                <div className="flex gap-2">
                  <Link to="/plan" className="btn btn-primary">Plan meals</Link>
                  {canMake > 0 && <Link to="/recipes?f=canmake" className="btn btn-secondary">What can I make?</Link>}
                </div>
              }
            />
          </div>
        ) : (
          todays.map((m) => {
            const r = recipeById.get(m.recipeId);
            if (!r) return null;
            const cooked = m.status === 'cooked';
            return (
              <div key={m.id} className="card flex items-center gap-3 p-3">
                <Link to={`/recipes/${r.id}`}>
                  <RecipeThumb recipe={r} className="h-16 w-16 text-3xl" />
                </Link>
                <Link to={`/recipes/${r.id}`} className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-stone-500 capitalize">{m.slot}{m.leftoverOf ? ' · leftovers' : ''}</div>
                  <div className="truncate font-semibold">{r.title}</div>
                  <div className="text-xs text-stone-500">{r.prepMin + r.cookMin} min · serves {m.servings}</div>
                </Link>
                {cooked ? (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">Cooked</span>
                ) : m.leftoverOf ? null : (
                  <Link to={`/recipes/${r.id}/cook?meal=${m.id}`} className="btn btn-primary px-4">Cook</Link>
                )}
              </div>
            );
          })
        )}

        {timeline.length > 0 && (
          <>
            <h2 className="section-title flex items-center gap-1"><Timer size={13} /> Prep ahead</h2>
            <div className="card divide-y divide-stone-100">
              {timeline.slice(0, 8).map((t) => {
                const r = recipeById.get(t.recipeId);
                const late = t.at <= clock;
                return (
                  <Link key={t.id} to={`/recipes/${t.recipeId}`} className="flex items-center gap-3 p-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${late ? 'bg-red-50' : 'bg-sky-50'}`}>
                      {PREP_EMOJI[t.kind]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{t.title}</div>
                      <div className="truncate text-xs text-stone-500">
                        <span className={late ? 'font-semibold text-red-600' : 'font-medium text-stone-700'}>
                          {late ? 'Start now' : `${relativeDayLabel(toISODate(new Date(t.at)), today)} ${formatClock(t.at)}`}
                        </span>
                        {' · '}{t.duration}{r ? ` · ${r.title}` : ''}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-stone-300" />
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {alerts.length > 0 && (
          <>
            <h2 className="section-title flex items-center gap-1"><AlertTriangle size={13} /> Heads up</h2>
            <div className="card divide-y divide-stone-100">
              {alerts.slice(0, 6).map((a) => {
                const s = ALERT_STYLE[a.kind];
                return (
                  <Link key={a.id} to={a.recipeId && !a.ingredientId ? `/recipes/${a.recipeId}` : a.kind === 'short' ? '/shop' : `/pantry/${a.ingredientId}`} className="flex items-center gap-3 p-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${s.tone}`}>
                      <s.icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{a.title}</div>
                      <div className="truncate text-xs text-stone-500">{a.detail}</div>
                    </div>
                    <ChevronRight size={18} className="text-stone-300" />
                  </Link>
                );
              })}
              {alerts.length > 6 && <Link to="/pantry" className="block p-3 text-center text-sm font-medium text-brand">+{alerts.length - 6} more</Link>}
            </div>
          </>
        )}

        <h2 className="section-title">Coming up</h2>
        <div className="card divide-y divide-stone-100">
          {upcoming.length === 0 && <p className="p-4 text-sm text-stone-500">No meals planned for the rest of the week.</p>}
          {upcoming.map((m) => {
            const r = recipeById.get(m.recipeId);
            if (!r) return null;
            return (
              <Link key={m.id} to={`/recipes/${r.id}`} className="flex items-center gap-3 p-3">
                <RecipeThumb recipe={r} className="h-10 w-10 text-xl" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.title}</div>
                  <div className="text-xs text-stone-500 capitalize">{relativeDayLabel(m.date, today)} · {m.slot}</div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-4">
          <Link to="/plan" className="card flex flex-col items-center gap-1 p-3 text-center text-xs font-semibold">
            <CalendarDays className="text-brand" /> Plan week
          </Link>
          <Link to="/shop" className="card flex flex-col items-center gap-1 p-3 text-center text-xs font-semibold">
            <ShoppingCart className="text-brand" /> Shopping list
          </Link>
          <Link to="/recipes/new" className="card flex flex-col items-center gap-1 p-3 text-center text-xs font-semibold">
            <BookPlus className="text-brand" /> Add recipe
          </Link>
        </div>
        <p className="px-1 pt-2 text-center text-xs text-stone-500">Next shopping day: {relativeDayLabel(shopDay, today)}</p>

        {needsBackup && (
          <Link to="/settings" className="card mt-3 flex items-center gap-3 border-amber-200 bg-amber-50 p-3 text-sm">
            <span className="text-xl">💾</span>
            <span className="flex-1">
              <b>Back up your data.</b> iPhone can clear website storage — save a backup file now and then.
            </span>
            <ChevronRight size={18} className="text-amber-400" />
          </Link>
        )}
      </div>
    </>
  );
}
