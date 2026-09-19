import { ChevronLeft, ChevronRight, ListChecks, MoreHorizontal, Pin, Plus, ShoppingCart, Sparkles, Zap } from 'lucide-react';
import { equipmentForRecipes } from '../../domain/dishes';
import { cookableRecipes, type Cookable } from '../../domain/quickadd';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { autoPlan, usesSmoker, eligibleRecipes, type AutoPick, type PlanSlot } from '../../domain/autoplan';
import { addDaysISO, formatDay, rangeDays, relativeDayLabel, startOfWeekISO } from '../../domain/dates';
import { SLOT_ORDER } from '../../domain/stock';
import { SLOTS, type PlannedMeal, type Slot } from '../../domain/types';
import { addLeftovers, addMeal, applyAutoPlan, copyWeek, removeMeal, setSkipped, updateMeal } from '../../services/plan';
import { buildICS, reminderEvents } from '../../domain/ics';
import { planToText } from '../../domain/recipetext';
import { downloadFile, shareText } from '../share';
import { CalendarArrowDown, CopyPlus, Share2 } from 'lucide-react';
import { PageHeader, RecipeCard, RecipeThumb, SearchInput, Segmented, Sheet } from '../components';
import { useAppData, type AppData } from '../data';
import { useCoverage, useDishInfo, usePrices } from '../hooks';
import { money, recipeCost } from '../../domain/prices';
import { useToast } from '../toast';
import Fuse from 'fuse.js';
import { useUpCandidates, type UseUpItem } from '../../domain/freshness';
import { formatQty } from '../../domain/units';
import { BookMarked, Clock3, Printer, Snowflake, Soup } from 'lucide-react';
import { weekBalance } from '../../domain/balance';
import { fillFromPool } from '../../services/plan';
import { freezePortions, planBatchCook, unbatch } from '../../services/leftovers';
import { SMART_COLLECTIONS, smartMembers } from '../../domain/smartcollections';
import { lastCooked } from '../../domain/rotation';

function planInput(d: AppData, slots: PlanSlot[], seed: number, avoid?: Map<string, string[]>, useUp?: string[], keeping: AutoPick[] = []) {
  // Meals you asked to keep are treated as already planned, so the rest of the week is picked
  // around them — no repeats, and their ingredients are spoken for.
  const held: PlannedMeal[] = keeping.map((p, i) => ({
    id: `keep:${i}`, recipeId: p.recipeId, date: p.date, slot: p.slot,
    servings: d.settings.householdSize, status: 'planned' as const,
  }));
  return {
    slots, existing: [...d.meals, ...held], recipes: d.recipes, ingById: d.ingById, lots: d.lots, loose: d.loose,
    recentCooks: d.cookLogs.map((c) => ({ recipeId: c.recipeId, at: c.at })),
    settings: d.settings, servings: d.settings.householdSize, today: d.today, now: d.now, seed, avoid, useUp,
  };
}

/** Spread `count` meals over the free days, e.g. 5 dinners over 7 days skips 2 days. */
function spread(days: string[], count: number): string[] {
  if (count >= days.length) return days;
  if (count <= 0) return [];
  const step = days.length / count;
  return Array.from({ length: count }, (_, i) => days[Math.floor(i * step)]);
}

/**
 * useState that survives leaving the screen (e.g. opening a suggested recipe and coming back),
 * so auto-fill picks aren't thrown away and regenerated. Session-only: a fresh app launch starts clean.
 */
function useSessionState<T>(key: string, init: () => T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch { /* storage blocked */ }
    return init();
  });
  const set = (v: T) => {
    setValue(v);
    try {
      sessionStorage.setItem(key, JSON.stringify(v));
    } catch { /* storage blocked */ }
  };
  return [value, set];
}

export function Plan() {
  const d = useAppData();
  const { today, meals, recipeById, settings } = d;
  const toast = useToast();
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useSessionState('plan:week', () => startOfWeekISO(today, settings.weekStartsOn));
  const days = rangeDays(weekStart, addDaysISO(weekStart, 6));
  const weekEnd = days[6];
  const [adding, setAdding] = useState<{ date: string; slot: Slot; swap?: PlannedMeal } | null>(null);
  const [menuMeal, setMenuMeal] = useState<PlannedMeal | null>(null);
  const [storedPicks, setPicks] = useSessionState<AutoPick[] | null>('plan:picks', () => null);
  // drop picks whose recipe has since been deleted
  const picks = storedPicks?.filter((p) => recipeById.has(p.recipeId)) ?? null;
  const [seed, setSeed] = useSessionState('plan:seed', () => 1);
  const [useUpAsk, setUseUpAsk] = useState<UseUpItem[] | null>(null);
  const [useUpIds, setUseUpIds] = useSessionState<string[]>('plan:useUp', () => []);
  const [quickDay, setQuickDay] = useState<{ date: string; slot: Slot } | null>(null);
  const [kept, setKept] = useSessionState<string[]>('plan:kept', () => []);
  const [weekMenu, setWeekMenu] = useState(false);
  const [fromCollection, setFromCollection] = useState(false);

  const weekMeals = meals.filter((m) => m.date >= weekStart && m.date <= weekEnd);
  const plannedCount = weekMeals.filter((m) => m.status === 'planned' && !m.leftoverOf).length;
  const prices = usePrices();
  const weekCost = weekMeals
    .filter((m) => m.status !== 'skipped' && !m.leftoverOf)
    .reduce((sum, m) => {
      const r = recipeById.get(m.recipeId);
      return r ? sum + recipeCost(r, m.servings, d.ingById, prices).total : sum;
    }, 0);
  const balance = useMemo(
    () => weekBalance({ meals: weekMeals, recipeById, ingById: d.ingById, weeknightMaxMin: settings.weeknightMaxMin }),
    [weekMeals, recipeById, d.ingById, settings.weeknightMaxMin],
  );
  const slotsShown = SLOTS.filter((s) => settings.enabledSlots.includes(s) || weekMeals.some((m) => m.slot === s));

  const openSlotsForAutofill = (): PlanSlot[] => {
    const out: PlanSlot[] = [];
    for (const slot of settings.enabledSlots) {
      const have = weekMeals.filter((m) => m.slot === slot && m.status !== 'skipped').length;
      const free = days.filter((day) => day >= today && !weekMeals.some((m) => m.date === day && m.slot === slot));
      for (const date of spread(free, (settings.mealsPerWeek[slot] ?? 0) - have)) out.push({ date, slot });
    }
    return out;
  };

  const runAuto = (s: number, useUp = useUpIds, keeping: AutoPick[] = [], avoid?: Map<string, string[]>) => {
    const held = keeping.filter((p) => !p.side);
    const slots = openSlotsForAutofill().filter((sl) => !held.some((k) => k.date === sl.date && k.slot === sl.slot));
    if (!slots.length && !held.length) {
      toast(weekEnd < today ? "That week's already past" : 'This week is already full');
      return;
    }
    setSeed(s);
    const fresh = slots.length ? autoPlan(planInput(d, slots, s, avoid, useUp, held)) : [];
    setPicks([...keeping, ...fresh].sort((a, b) => a.date.localeCompare(b.date) || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] || Number(a.side) - Number(b.side)));
  };

  /** Re-pick everything except the meals marked "keep". */
  const shuffleRest = () => {
    const keeping = (picks ?? []).filter((p) => kept.includes(`${p.date}:${p.slot}`));
    const keepIds = new Set(keeping.map((k) => `${k.date}:${k.slot}`));
    runAuto(seed + 1, useUpIds, (picks ?? []).filter((p) => keepIds.has(`${p.date}:${p.slot}`)));
  };

  /** Swap out the smoker meals for something cooked indoors. */
  const dropSmoker = () => {
    const smokerPicks = (picks ?? []).filter((p) => p.usesSmoker);
    const avoid = new Map<string, string[]>();
    for (const p of smokerPicks) avoid.set(`${p.date}:${p.slot}`, d.recipes.filter((r) => usesSmoker(r)).map((r) => r.id));
    const keeping = (picks ?? []).filter((p) => !p.usesSmoker && !smokerPicks.some((sp) => sp.date === p.date && sp.slot === p.slot));
    runAuto(seed + 1, useUpIds, keeping, avoid);
  };

  /** Ask about food that's been sitting around before filling the week. */
  const startAuto = () => {
    if (!openSlotsForAutofill().length) return runAuto(0);
    const items = useUpCandidates({ lots: d.lots, loose: d.loose, ingById: d.ingById, meals: d.meals, recipesById: recipeById, today });
    if (items.length) setUseUpAsk(items);
    else runAuto(Date.now() % 100000, []);
  };

  return (
    <>
      <PageHeader
        title="Meal plan"
        subtitle={`${plannedCount} meal${plannedCount === 1 ? '' : 's'} planned${weekCost > 0 ? ` · about ${money(weekCost)} in ingredients` : ''}`}
        right={
          <div className="flex">
            <Link to="/prep" className="btn btn-ghost px-3" aria-label="Prep list">
              <ListChecks size={18} /> Prep
            </Link>
            <button className="btn btn-ghost px-3" onClick={startAuto}>
              <Sparkles size={18} /> Auto-fill
            </button>
            <button className="icon-btn" aria-label="Week options" onClick={() => setWeekMenu(true)}>
              <MoreHorizontal size={20} />
            </button>
          </div>
        }
      />
      <div className="px-4">
        <div className="card flex items-center justify-between p-1">
          <button className="icon-btn" aria-label="Previous week" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>
            <ChevronLeft />
          </button>
          <button className="text-center" onClick={() => setWeekStart(startOfWeekISO(today, settings.weekStartsOn))}>
            <div className="font-semibold">{formatDay(weekStart, 'MMM d')} – {formatDay(weekEnd, 'MMM d')}</div>
            <div className="text-xs text-stone-500">
              {today >= weekStart && today <= weekEnd ? 'This week' : 'Tap for this week'}
            </div>
          </button>
          <button className="icon-btn" aria-label="Next week" onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>
            <ChevronRight />
          </button>
        </div>

        {balance.meals >= 2 && <BalanceMeter balance={balance} />}

        <div className="mt-3 space-y-3">
          {days.map((day) => {
            const past = day < today;
            const dayMeals = weekMeals
              .filter((m) => m.date === day)
              .sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
            const cookware = equipmentForRecipes(
              dayMeals.filter((m) => m.status !== 'skipped' && !m.leftoverOf).map((m) => recipeById.get(m.recipeId)).filter((r) => !!r),
            );
            return (
              <section key={day} className={past ? 'opacity-60' : ''}>
                <div className="flex items-baseline justify-between px-1 pb-1.5">
                  <h2 className={`font-semibold ${day === today ? 'text-brand' : ''}`}>
                    {relativeDayLabel(day, today) === formatDay(day) ? formatDay(day, 'EEEE') : relativeDayLabel(day, today)}
                    <span className="ml-2 text-sm font-normal text-stone-400">{formatDay(day, 'MMM d')}</span>
                  </h2>
                </div>
                {cookware.length > 0 && !past && (
                  <div className="no-scrollbar -mx-4 mb-1.5 flex gap-1.5 overflow-x-auto px-5" aria-label="Cookware needed">
                    {cookware.map((e) => (
                      <span key={e.id} className="shrink-0 rounded-full bg-stone-200/70 px-2 py-0.5 text-xs text-stone-700">
                        {e.emoji} {e.label}{e.count > 1 ? ` ×${e.count}` : ''}
                      </span>
                    ))}
                  </div>
                )}
                <div className="card divide-y divide-stone-100">
                  {dayMeals.map((m) => {
                    const r = recipeById.get(m.recipeId);
                    if (!r) return null;
                    return (
                      <div key={m.id} className={`flex items-center gap-3 p-2.5 ${m.status === 'skipped' ? 'opacity-50' : ''}`}>
                        <Link to={`/recipes/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                          <RecipeThumb recipe={r} className="h-12 w-12 text-2xl" />
                          <div className="min-w-0">
                            <div className={`truncate font-medium ${m.status === 'skipped' ? 'line-through' : ''}`}>{r.title}</div>
                            <div className="text-xs text-stone-500 capitalize">
                              {m.slot} · {m.servings} serving{m.servings === 1 ? '' : 's'}
                              {m.leftoverOf && ' · leftovers'}
                              {m.status === 'cooked' && ' · ✅ cooked'}
                              {m.status === 'skipped' && ' · skipped'}
                            </div>
                          </div>
                        </Link>
                        <button className="icon-btn shrink-0" aria-label={`Options for ${r.title}`} onClick={() => setMenuMeal(m)}>
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                    );
                  })}
                  {!past && (
                    <div className="flex gap-1 p-1.5">
                      {slotsShown
                        .filter((s) => !dayMeals.some((m) => m.slot === s))
                        .map((s) => (
                          <button key={s} className="btn btn-ghost flex-1 px-2 py-1.5 text-sm capitalize" onClick={() => setAdding({ date: day, slot: s })}>
                            <Plus size={16} /> {s}
                          </button>
                        ))}
                      {slotsShown.every((s) => dayMeals.some((m) => m.slot === s)) && (
                        <button className="btn btn-ghost flex-1 px-2 py-1.5 text-sm" onClick={() => setAdding({ date: day, slot: 'dinner' })}>
                          <Plus size={16} /> Add another
                        </button>
                      )}
                      <button
                        className="btn btn-ghost shrink-0 px-2 py-1.5 text-sm"
                        aria-label="Quick add from what you have"
                        onClick={() => setQuickDay({ date: day, slot: slotsShown.find((s) => !dayMeals.some((m) => m.slot === s)) ?? 'dinner' })}
                      >
                        <Zap size={16} /> Have it
                      </button>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <button
          className="btn btn-primary mt-5 w-full py-3"
          onClick={() => navigate(`/shop?from=${weekStart < today ? today : weekStart}&to=${weekEnd}`)}
          disabled={weekEnd < today}
        >
          <ShoppingCart size={18} /> Shopping list for this week
        </button>
      </div>

      {adding && (
        <ChooseRecipeSheet
          date={adding.date}
          slot={adding.slot}
          swapping={!!adding.swap}
          onClose={() => setAdding(null)}
          onSuggest={() => {
            const avoid = new Map([[`${adding.date}:${adding.slot}`, adding.swap ? [adding.swap.recipeId] : []]]);
            const others = adding.swap ? d.meals.filter((m) => m.id !== adding.swap!.id) : d.meals;
            const [pick] = autoPlan({ ...planInput(d, [{ date: adding.date, slot: adding.slot }], Date.now() % 100000, avoid), existing: others });
            return pick?.recipeId;
          }}
          onChoose={async (recipeId, slot) => {
            if (adding.swap) {
              await updateMeal(adding.swap.id, { recipeId, slot });
              toast('Meal swapped');
            } else {
              const id = await addMeal(recipeId, adding.date, slot, settings.householdSize);
              toast(`Added ${recipeById.get(recipeId)?.title}`, { label: 'Undo', run: () => removeMeal(id) });
            }
            setAdding(null);
          }}
        />
      )}

      {quickDay && (
        <QuickAddSheet
          date={quickDay.date}
          slot={quickDay.slot}
          onClose={() => setQuickDay(null)}
          onChoose={async (recipeId, slot) => {
            const id = await addMeal(recipeId, quickDay.date, slot, settings.householdSize);
            toast(`Added ${recipeById.get(recipeId)?.title}`, { label: 'Undo', run: () => removeMeal(id) });
            setQuickDay(null);
          }}
        />
      )}

      {menuMeal && (
        <MealMenu
          meal={menuMeal}
          onClose={() => setMenuMeal(null)}
          onSwap={() => {
            setAdding({ date: menuMeal.date, slot: menuMeal.slot, swap: menuMeal });
            setMenuMeal(null);
          }}
        />
      )}

      {useUpAsk && (
        <UseUpSheet
          items={useUpAsk}
          today={today}
          onClose={() => setUseUpAsk(null)}
          onGo={(ids) => {
            setUseUpAsk(null);
            setUseUpIds(ids);
            runAuto(Date.now() % 100000, ids);
          }}
        />
      )}

      <Sheet
        open={!!picks}
        onClose={() => setPicks(null)}
        title="Suggested meals"
        footer={
          <div className="flex gap-2">
            <button className="btn btn-secondary flex-1" onClick={shuffleRest}>
              {kept.length ? 'Shuffle the rest' : 'Shuffle'}
            </button>
            <button
              className="btn btn-primary flex-[2]"
              disabled={!picks?.length}
              onClick={async () => {
                if (!picks) return;
                await applyAutoPlan(picks, settings.householdSize);
                setPicks(null);
                const frozen = new Set(
                  picks.flatMap((p) => recipeById.get(p.recipeId)?.ingredients.map((ri) => ri.ingredientId) ?? [])
                    .filter((ingId) => d.lots.some((l) => l.ingredientId === ingId && l.location === 'freezer')),
                );
                toast(
                  frozen.size
                    ? `Added ${picks.length} meals · some use frozen ${[...frozen].map((x) => d.ingById.get(x)?.name.toLowerCase()).slice(0, 2).join(' & ')} — we'll remind you to thaw`
                    : `Added ${picks.length} meals`,
                );
              }}
            >
              Add {picks?.length ?? 0} meals
            </button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-stone-500">
          Picked to use what you have, save expiring food, and keep things varied. Pin the ones you want and
          shuffle the rest; tap × to leave one out.
        </p>
        {settings.smokerConfirm !== false && picks?.some((p) => p.usesSmoker) && (
          <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <b>Smoker night.</b> {picks.filter((p) => p.usesSmoker).map((p) => recipeById.get(p.recipeId)?.title).join(' and ')} {picks.filter((p) => p.usesSmoker).length === 1 ? 'is' : 'are'} cooked in the smoker. Keep it?
            <div className="mt-2 flex gap-2">
              <button className="btn btn-secondary flex-1 py-1" onClick={dropSmoker}>Cook indoors instead</button>
            </div>
          </div>
        )}
        {picks?.length === 0 && <p className="text-sm">No recipes match your settings. Check diet filters in Settings.</p>}
        <div className="space-y-2">
          {picks?.map((p, i) => {
            const r = recipeById.get(p.recipeId)!;
            const key = `${p.date}:${p.slot}`;
            const keep = kept.includes(key);
            return (
              <div key={`${key}:${p.recipeId}`} className={`flex items-center gap-2 ${p.side ? 'pl-6' : ''}`}>
                <div className="min-w-0 flex-1">
                  <RecipeCard
                    recipe={r}
                    to={`/recipes/${r.id}`}
                    subtitle={
                      <span className="truncate capitalize">
                        {p.side ? 'Side · ' : ''}{relativeDayLabel(p.date, today)} · {p.slot}
                        {p.usesSmoker ? ' · 🔥 smoker' : ''}{p.reasons[0] ? ` · ${p.reasons[0]}` : ''}
                      </span>
                    }
                  />
                </div>
                {!p.side && (
                  <button
                    className={`icon-btn shrink-0 ${keep ? 'text-brand' : 'text-stone-300'}`}
                    aria-label={keep ? `Stop keeping ${r.title}` : `Keep ${r.title}`}
                    aria-pressed={keep}
                    onClick={() => setKept(keep ? kept.filter((k) => k !== key) : [...kept, key])}
                  >
                    <Pin size={18} />
                  </button>
                )}
                <button className="icon-btn shrink-0 text-stone-400" aria-label="Leave out" onClick={() => setPicks(picks.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={weekMenu} onClose={() => setWeekMenu(false)} title={`Week of ${formatDay(weekStart, 'MMM d')}`}>
        <div className="space-y-1">
          <button
            className="btn btn-secondary w-full justify-start"
            onClick={async () => {
              const res = await copyWeek(addDaysISO(weekStart, -7), weekStart, today);
              setWeekMenu(false);
              toast(
                res.copied
                  ? `Copied ${res.copied} meal${res.copied === 1 ? '' : 's'} from last week${res.skipped ? ` · ${res.skipped} skipped` : ''}`
                  : 'Nothing to copy from last week',
              );
            }}
          >
            <CopyPlus size={18} /> Repeat last week
          </button>
          <button
            className="btn btn-secondary w-full justify-start"
            onClick={async () => {
              const res = await copyWeek(weekStart, addDaysISO(weekStart, 7), today);
              setWeekMenu(false);
              if (res.copied) setWeekStart(addDaysISO(weekStart, 7));
              toast(res.copied ? `Copied ${res.copied} meal${res.copied === 1 ? '' : 's'} into next week` : 'Nothing in this week to copy');
            }}
          >
            <CopyPlus size={18} /> Copy this week forward
          </button>
          <button
            className="btn btn-secondary w-full justify-start"
            onClick={() => { setWeekMenu(false); setFromCollection(true); }}
          >
            <BookMarked size={18} /> Fill the week from a collection
          </button>
          <button
            className="btn btn-secondary w-full justify-start"
            disabled={!weekMeals.length}
            onClick={() => { setWeekMenu(false); navigate(`/menu?w=${weekStart}`); }}
          >
            <Printer size={18} /> Menu card for the fridge
          </button>
          <button
            className="btn btn-secondary w-full justify-start"
            disabled={!weekMeals.length}
            onClick={async () => {
              const text = planToText({
                days: days.map((day) => ({
                  date: day,
                  label: formatDay(day, 'EEE MMM d'),
                  meals: weekMeals
                    .filter((m) => m.date === day)
                    .map((m) => ({ slot: m.slot, title: recipeById.get(m.recipeId)?.title ?? 'Leftovers', servings: m.servings })),
                })),
              });
              const res = await shareText('Meal plan', text);
              setWeekMenu(false);
              toast(res === 'copied' ? 'Plan copied to the clipboard' : res === 'failed' ? "Couldn't share that" : 'Shared');
            }}
          >
            <Share2 size={18} /> Share this week as text
          </button>
          <button
            className="btn btn-secondary w-full justify-start"
            onClick={() => {
              const events = reminderEvents({
                meals: d.meals, recipesById: recipeById, ingById: d.ingById, lots: d.lots, loose: d.loose,
                today, shoppingDay: settings.shoppingDay, days: 14,
              });
              setWeekMenu(false);
              if (!events.length) {
                toast('Nothing to remind you about in the next two weeks');
                return;
              }
              downloadFile('meal-planner.ics', 'text/calendar', buildICS(events, Date.now()));
              toast(`${events.length} reminder${events.length === 1 ? '' : 's'} — open the file to add them to Calendar`);
            }}
          >
            <CalendarArrowDown size={18} /> Send reminders to Calendar
          </button>
          <p className="px-1 pt-2 text-xs text-stone-500">
            Calendar reminders cover thawing, prep the night before, use-by dates and your shopping day for the next two weeks. They carry alarms, which a web app can't set on its own.
          </p>
        </div>
      </Sheet>

      {fromCollection && (
        <FillFromCollectionSheet
          weekStart={weekStart}
          weekEnd={weekEnd}
          onClose={() => setFromCollection(false)}
        />
      )}
    </>
  );
}

/** How varied the week is, as one bar and a few plain-English notes. */
function BalanceMeter({ balance }: { balance: ReturnType<typeof weekBalance> }) {
  const tone = balance.score >= 75 ? 'bg-green-500' : balance.score >= 50 ? 'bg-amber-400' : 'bg-orange-400';
  return (
    <div className="card mt-3 p-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Week balance</h2>
        <span className="text-sm font-semibold text-stone-500">{balance.score}/100</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${balance.score}%` }} />
      </div>
      <ul className="mt-2 space-y-1 text-xs">
        {balance.notes.slice(0, 4).map((n) => (
          <li key={n.id} className={n.tone === 'warn' ? 'text-amber-700' : 'text-stone-500'}>
            {n.tone === 'warn' ? '• ' : '✓ '}{n.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Deal a collection out across the week's free nights. */
function FillFromCollectionSheet(props: { weekStart: string; weekEnd: string; onClose: () => void }) {
  const d = useAppData();
  const toast = useToast();
  const cooked = useMemo(() => lastCooked(d.cookLogs), [d.cookLogs]);
  const coverage = useCoverage();
  const ctx = useMemo(
    () => ({
      date: d.today, lastCookedAt: cooked, now: d.now, weeknightMaxMin: d.settings.weeknightMaxMin,
      coverage: new Map([...coverage].map(([id, c]) => [id, c.ratio])),
    }),
    [d.today, cooked, d.now, d.settings.weeknightMaxMin, coverage],
  );
  const slot = d.settings.enabledSlots[0] ?? 'dinner';

  const fill = async (name: string, recipeIds: string[]) => {
    const res = await fillFromPool({
      recipeIds, from: props.weekStart, to: props.weekEnd, slot,
      servings: d.settings.householdSize, today: d.today,
    });
    props.onClose();
    toast(
      res.added
        ? `${res.added} night${res.added === 1 ? '' : 's'} from ${name}${res.unfilled ? ` · ${res.unfilled} left open` : ''}`
        : 'No free nights left this week',
    );
  };

  return (
    <Sheet open onClose={props.onClose} title="Fill the week from…">
      <p className="mb-3 text-sm text-stone-500">
        Free {slot} slots get filled in order, one recipe each. Anything already planned is left alone.
      </p>
      <div className="space-y-2">
        {d.collections.map((c) => (
          <button key={c.id} className="card flex w-full items-center gap-3 p-3 text-left" onClick={() => void fill(c.name, c.recipeIds)}>
            <span className="text-xl">{c.emoji ?? '📚'}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{c.name}</span>
              <span className="block text-xs text-stone-500">{c.recipeIds.length} recipe{c.recipeIds.length === 1 ? '' : 's'}</span>
            </span>
          </button>
        ))}
        <h3 className="section-title">Smart collections</h3>
        {SMART_COLLECTIONS.map((c) => {
          const members = smartMembers(c, d.recipes, ctx);
          return (
            <button
              key={c.id}
              className="card flex w-full items-center gap-3 p-3 text-left disabled:opacity-50"
              disabled={!members.length}
              onClick={() => void fill(c.name, members.slice(0, 7).map((r) => r.id))}
            >
              <span className="text-xl">{c.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{c.name}</span>
                <span className="block text-xs text-stone-500">{members.length} recipe{members.length === 1 ? '' : 's'}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

function UseUpSheet(props: { items: UseUpItem[]; today: string; onClose: () => void; onGo: (ingredientIds: string[]) => void }) {
  const { settings } = useAppData();
  const [picked, setPicked] = useState(() => new Set(props.items.map((i) => i.ing.id)));
  const byIng = [...new Map(props.items.map((i) => [i.ing.id, i])).values()];
  return (
    <Sheet
      open
      onClose={props.onClose}
      title="Use these up?"
      footer={
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1" onClick={() => props.onGo([])}>Skip</button>
          <button className="btn btn-primary flex-[2]" onClick={() => props.onGo([...picked])}>
            {picked.size ? `Plan around ${picked.size} item${picked.size === 1 ? '' : 's'}` : 'Plan meals'}
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-stone-500">These have been sitting a while and no meal is planned for them yet. We'll favor recipes that use the ones you check.</p>
      <ul className="card divide-y divide-stone-100">
        {byIng.map((it) => (
          <li key={it.ing.id}>
            <label className="flex items-center gap-3 p-3">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--color-brand)]"
                checked={picked.has(it.ing.id)}
                onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(it.ing.id)) n.delete(it.ing.id); else n.add(it.ing.id); return n; })}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{it.ing.name}</div>
                <div className="text-xs text-stone-500">
                  {formatQty(it.spare, it.ing, settings.units)} left · bought {it.ageDays === 0 ? 'today' : `${it.ageDays} day${it.ageDays === 1 ? '' : 's'} ago`}
                  {it.daysLeft !== undefined && it.daysLeft !== null && ` · ${it.daysLeft <= 0 ? 'use today' : `good ~${it.daysLeft} more day${it.daysLeft === 1 ? '' : 's'}`}`}
                </div>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function ChooseRecipeSheet(props: {
  date: string;
  slot: Slot;
  swapping: boolean;
  onClose: () => void;
  onSuggest: () => string | undefined;
  onChoose: (recipeId: string, slot: Slot) => void;
}) {
  const d = useAppData();
  const coverage = useCoverage();
  const [slot, setSlot] = useState(props.slot);
  const [q, setQ] = useState('');
  const [suggested, setSuggested] = useState<string | undefined>(() => props.onSuggest());
  const dish = useDishInfo();
  const [kind, setKind] = useState<'meal' | 'side' | 'dessert'>('meal');

  const pool = useMemo(() => {
    if (kind !== 'meal') {
      const want = kind === 'side' ? ['side', 'salad', 'sauce'] : ['dessert'];
      return d.recipes.filter((r) => !r.archived && want.includes(dish.get(r.id)?.dishType ?? ''));
    }
    const eligible = eligibleRecipes(d.recipes, slot, props.date, { ...d.settings, weeknightMaxMin: 0 }, d.ingById);
    return eligible.length ? eligible : d.recipes.filter((r) => !r.archived);
  }, [d.recipes, d.settings, slot, props.date, kind, dish]);
  const fuse = useMemo(() => new Fuse(pool, { keys: ['title', 'cuisine', 'protein'], threshold: 0.35, ignoreLocation: true }), [pool]);
  const list = q.trim()
    ? fuse.search(q.trim()).map((x) => x.item)
    : [...pool].sort((a, b) => Number(b.favorite) - Number(a.favorite) || (coverage.get(b.id)?.ratio ?? 0) - (coverage.get(a.id)?.ratio ?? 0));
  const sug = suggested ? d.recipeById.get(suggested) : undefined;

  return (
    <Sheet open onClose={props.onClose} title={`${props.swapping ? 'Swap' : 'Add'} · ${relativeDayLabel(props.date, d.today)}`}>
      <Segmented value={slot} options={SLOTS.map((s) => ({ value: s, label: <span className="capitalize">{s}</span> }))} onChange={setSlot} />
      {!props.swapping && (
        <div className="mt-2">
          <Segmented
            value={kind}
            options={[{ value: 'meal', label: 'Meals' }, { value: 'side', label: 'Sides' }, { value: 'dessert', label: 'Desserts' }]}
            onChange={setKind}
          />
        </div>
      )}
      {sug && !q && kind === 'meal' && (
        <div className="mt-3">
          <div className="section-title flex items-center justify-between pt-0">
            <span className="flex items-center gap-1"><Sparkles size={12} /> Suggestion</span>
            <button className="text-brand normal-case" onClick={() => setSuggested(props.onSuggest())}>Another</button>
          </div>
          <button className="w-full text-left" onClick={() => props.onChoose(sug.id, slot)}>
            <div className="pointer-events-none">
              <RecipeCard recipe={sug} coverage={coverage.get(sug.id)} to="#" />
            </div>
          </button>
        </div>
      )}
      <div className="sticky top-0 z-10 mt-3 bg-white pb-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search recipes" />
      </div>
      <div className="space-y-2">
        {list.map((r) => (
          <button key={r.id} className="w-full text-left" onClick={() => props.onChoose(r.id, slot)}>
            <div className="pointer-events-none">
              <RecipeCard recipe={r} coverage={coverage.get(r.id)} to="#" />
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Recipes you can make on this day with only what's already in the kitchen. */
function QuickAddSheet(props: { date: string; slot: Slot; onClose: () => void; onChoose: (recipeId: string, slot: Slot) => void }) {
  const d = useAppData();
  const dish = useDishInfo();
  const [slot, setSlot] = useState(props.slot);
  const list = useMemo(() => {
    const pool = eligibleRecipes(d.recipes, slot, props.date, { ...d.settings, weeknightMaxMin: 0 }, d.ingById);
    return cookableRecipes({
      recipes: pool, date: props.date, slot, servings: d.settings.householdSize,
      meals: d.meals, lots: d.lots, loose: d.loose, ingById: d.ingById, today: d.today,
    });
  }, [d.recipes, d.settings, d.ingById, d.meals, d.lots, d.loose, d.today, slot, props.date]);
  // Sides you could make alongside — only for dinner, where the main list is protein-only.
  const sides = useMemo(() => {
    if (slot !== 'dinner') return [];
    const pool = d.recipes.filter((r) => !r.archived && dish.get(r.id)?.dishType === 'side');
    return cookableRecipes({
      recipes: pool, date: props.date, slot, servings: d.settings.householdSize,
      meals: d.meals, lots: d.lots, loose: d.loose, ingById: d.ingById, today: d.today,
    }).slice(0, 8);
  }, [d.recipes, dish, d.settings.householdSize, d.meals, d.lots, d.loose, d.ingById, d.today, slot, props.date]);

  const row = (c: Cookable) => (
    <button key={c.recipe.id} className="w-full text-left" onClick={() => props.onChoose(c.recipe.id, slot)}>
      <div className="pointer-events-none">
        <RecipeCard
          recipe={c.recipe}
          to="#"
          subtitle={<span className="truncate">{c.recipe.prepMin + c.recipe.cookMin} min · {c.recipe.cuisine}{c.expiring ? ` · uses ${c.expiring} expiring` : ''}</span>}
        />
      </div>
    </button>
  );

  return (
    <Sheet open onClose={props.onClose} title={`Make with what you have · ${relativeDayLabel(props.date, d.today)}`}>
      <Segmented value={slot} options={SLOTS.map((s) => ({ value: s, label: <span className="capitalize">{s}</span> }))} onChange={setSlot} />
      <p className="my-3 text-sm text-stone-500">
        Everything these need is already in your kitchen, after setting aside what your other planned meals use. Nothing to buy.
      </p>
      {list.length === 0 ? (
        <p className="card p-4 text-sm text-stone-600">Nothing fits with what's on hand right now. Add what you have in the Pantry tab, or pick a recipe and add it to the shopping list.</p>
      ) : (
        <div className="space-y-2">{list.map(row)}</div>
      )}
      {sides.length > 0 && (
        <>
          <h3 className="section-title">Sides you could make too</h3>
          <div className="space-y-2">{sides.map(row)}</div>
        </>
      )}
    </Sheet>
  );
}

function MealMenu(props: { meal: PlannedMeal; onClose: () => void; onSwap: () => void }) {
  const { recipeById, today, settings, meals } = useAppData();
  const toast = useToast();
  const navigate = useNavigate();
  const m = props.meal;
  const r = recipeById.get(m.recipeId);
  const [servings, setServings] = useState(m.servings);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [portions, setPortions] = useState(2);
  const batched = meals.filter((x) => x.leftoverOf === m.id);
  const sameDay = meals.filter((x) => x.date === m.date && x.status !== 'skipped');
  if (!r) return null;
  const tomorrow = addDaysISO(m.date, 1);
  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    await fn();
    props.onClose();
    if (msg) toast(msg);
  };

  return (
    <Sheet open onClose={props.onClose} title={r.title}>
      <div className="space-y-2">
        {m.status === 'planned' && !m.leftoverOf && m.date >= addDaysISO(today, -1) && (
          <button className="btn btn-primary w-full" onClick={() => navigate(`/recipes/${r.id}/cook?meal=${m.id}`)}>Cook this now</button>
        )}
        <div className="card flex items-center justify-between p-3">
          <span className="font-medium">Servings</span>
          <div className="flex items-center gap-2">
            <button className="icon-btn h-8 w-8 bg-stone-100" aria-label="Fewer" onClick={() => setServings(Math.max(1, servings - 1))}>−</button>
            <span className="w-6 text-center font-semibold">{servings}</span>
            <button className="icon-btn h-8 w-8 bg-stone-100" aria-label="More" onClick={() => setServings(servings + 1)}>+</button>
            {servings !== m.servings && (
              <button className="btn btn-ghost px-2 py-1 text-sm" onClick={() => run(() => updateMeal(m.id, { servings }), 'Servings updated')}>Save</button>
            )}
          </div>
        </div>
        {m.status !== 'cooked' && <button className="btn btn-secondary w-full justify-start" onClick={props.onSwap}>🔄 Swap for another recipe</button>}
        {!m.leftoverOf && m.status !== 'skipped' && (
          <button
            className="btn btn-secondary w-full justify-start"
            onClick={() => run(() => addLeftovers(m.id, tomorrow, settings.enabledSlots.includes('lunch') ? 'lunch' : m.slot), `Leftovers planned for ${relativeDayLabel(tomorrow, today)}`)}
          >
            🥡 Plan leftovers for the next day
          </button>
        )}
        {!m.leftoverOf && m.status === 'planned' && (
          <div className="card p-3">
            <div className="flex items-center gap-2 font-medium"><Soup size={16} className="text-brand" /> Cook once, eat several times</div>
            {batched.length > 0 ? (
              <>
                <p className="mt-1 text-xs text-stone-500">
                  Cooking {m.servings} servings — {batched.length} extra night{batched.length === 1 ? '' : 's'} already on the calendar.
                </p>
                <button className="btn btn-ghost mt-2 w-full text-sm" onClick={() => run(() => unbatch(m.id), 'Back to a single night')}>
                  Undo the batch
                </button>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs text-stone-500">
                  Scale this up and drop the extra portions onto the next free nights. The shopping list follows automatically.
                </p>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      className="btn btn-secondary flex-1 text-sm"
                      onClick={() => run(async () => {
                        const res = await planBatchCook(m.id, n);
                        if (res && !res.nights.length) toast('No free nights to put leftovers on');
                      }, `Cooking for ${n + 1} nights`)}
                    >
                      +{n} night{n === 1 ? '' : 's'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {!m.leftoverOf && (
          <button className="btn btn-secondary w-full justify-start" onClick={() => setFreezeOpen(true)}>
            <Snowflake size={16} /> Freeze extra portions
          </button>
        )}
        {sameDay.length > 1 && (
          <button className="btn btn-secondary w-full justify-start" onClick={() => { props.onClose(); navigate(`/timeline/${m.date}`); }}>
            <Clock3 size={16} /> Time the whole meal ({sameDay.length} dishes)
          </button>
        )}
        {m.status !== 'cooked' && (
          <button className="btn btn-secondary w-full justify-start" onClick={() => run(() => setSkipped(m.id, m.status !== 'skipped'))}>
            {m.status === 'skipped' ? '↩️ Un-skip' : '⏭️ Skip this meal (keeps it off the shopping list)'}
          </button>
        )}
        <button className="btn btn-danger w-full justify-start" onClick={() => run(() => removeMeal(m.id), 'Removed from plan')}>
          🗑️ Remove from plan
        </button>
      </div>

      {freezeOpen && (
        <Sheet open onClose={() => setFreezeOpen(false)} title={`Freeze ${r.title}`}>
          <p className="mb-3 text-sm text-stone-500">
            Portions go into the freezer list with a best-by date three months out. Pull one back onto the plan any night you don't feel like cooking.
          </p>
          <div className="card flex items-center justify-between p-3">
            <span className="font-medium">Portions</span>
            <div className="flex items-center gap-2">
              <button className="icon-btn h-8 w-8 bg-stone-100" aria-label="Fewer" onClick={() => setPortions(Math.max(1, portions - 1))}>−</button>
              <span className="w-6 text-center font-semibold">{portions}</span>
              <button className="icon-btn h-8 w-8 bg-stone-100" aria-label="More" onClick={() => setPortions(portions + 1)}>+</button>
            </div>
          </div>
          <p className="mt-1 px-1 text-xs text-stone-500">Each portion serves {m.servings}.</p>
          <button
            className="btn btn-primary mt-3 w-full"
            onClick={() => run(
              () => freezePortions({ recipeId: r.id, portions, servingsEach: m.servings, today }),
              `${portions} portion${portions === 1 ? '' : 's'} in the freezer`,
            )}
          >
            Into the freezer
          </button>
        </Sheet>
      )}
    </Sheet>
  );
}
