import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, ShoppingCart, Sparkles, Zap } from 'lucide-react';
import { equipmentForRecipes } from '../../domain/dishes';
import { cookableRecipes, type Cookable } from '../../domain/quickadd';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { autoPlan, eligibleRecipes, type AutoPick, type PlanSlot } from '../../domain/autoplan';
import { addDaysISO, formatDay, rangeDays, relativeDayLabel, startOfWeekISO } from '../../domain/dates';
import { SLOT_ORDER } from '../../domain/stock';
import { SLOTS, type PlannedMeal, type Slot } from '../../domain/types';
import { addLeftovers, addMeal, applyAutoPlan, removeMeal, setSkipped, updateMeal } from '../../services/plan';
import { PageHeader, RecipeCard, RecipeThumb, SearchInput, Segmented, Sheet } from '../components';
import { useAppData, type AppData } from '../data';
import { useCoverage, useDishInfo } from '../hooks';
import { useToast } from '../toast';
import Fuse from 'fuse.js';
import { useUpCandidates, type UseUpItem } from '../../domain/freshness';
import { formatQty } from '../../domain/units';

function planInput(d: AppData, slots: PlanSlot[], seed: number, avoid?: Map<string, string[]>, useUp?: string[]) {
  return {
    slots, existing: d.meals, recipes: d.recipes, ingById: d.ingById, lots: d.lots, loose: d.loose,
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

  const weekMeals = meals.filter((m) => m.date >= weekStart && m.date <= weekEnd);
  const plannedCount = weekMeals.filter((m) => m.status === 'planned' && !m.leftoverOf).length;
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

  const runAuto = (s: number, useUp = useUpIds) => {
    const slots = openSlotsForAutofill();
    if (!slots.length) {
      toast(weekEnd < today ? "That week's already past" : 'This week is already full');
      return;
    }
    setSeed(s);
    setPicks(autoPlan(planInput(d, slots, s, undefined, useUp)));
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
        subtitle={`${plannedCount} meal${plannedCount === 1 ? '' : 's'} planned`}
        right={
          <button className="btn btn-ghost px-3" onClick={startAuto}>
            <Sparkles size={18} /> Auto-fill
          </button>
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
            <button className="btn btn-secondary flex-1" onClick={() => runAuto(seed + 1)}>Shuffle</button>
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
          Picked to use what you have, save expiring food, and keep things varied. Tap × to leave one out.
        </p>
        {picks?.length === 0 && <p className="text-sm">No recipes match your settings. Check diet filters in Settings.</p>}
        <div className="space-y-2">
          {picks?.map((p, i) => {
            const r = recipeById.get(p.recipeId)!;
            return (
              <div key={`${p.date}${p.slot}`} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <RecipeCard
                    recipe={r}
                    to={`/recipes/${r.id}`}
                    subtitle={
                      <span className="truncate capitalize">
                        {relativeDayLabel(p.date, today)} · {p.slot}{p.reasons[0] ? ` · ${p.reasons[0]}` : ''}
                      </span>
                    }
                  />
                </div>
                <button className="icon-btn shrink-0 text-stone-400" aria-label="Leave out" onClick={() => setPicks(picks.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </Sheet>
    </>
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

  const pool = useMemo(() => {
    const eligible = eligibleRecipes(d.recipes, slot, props.date, { ...d.settings, weeknightMaxMin: 0 }, d.ingById);
    return eligible.length ? eligible : d.recipes.filter((r) => !r.archived);
  }, [d.recipes, d.settings, slot, props.date]);
  const fuse = useMemo(() => new Fuse(pool, { keys: ['title', 'cuisine', 'protein'], threshold: 0.35, ignoreLocation: true }), [pool]);
  const list = q.trim()
    ? fuse.search(q.trim()).map((x) => x.item)
    : [...pool].sort((a, b) => Number(b.favorite) - Number(a.favorite) || (coverage.get(b.id)?.ratio ?? 0) - (coverage.get(a.id)?.ratio ?? 0));
  const sug = suggested ? d.recipeById.get(suggested) : undefined;

  return (
    <Sheet open onClose={props.onClose} title={`${props.swapping ? 'Swap' : 'Add'} · ${relativeDayLabel(props.date, d.today)}`}>
      <Segmented value={slot} options={SLOTS.map((s) => ({ value: s, label: <span className="capitalize">{s}</span> }))} onChange={setSlot} />
      {sug && !q && (
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
  const { recipeById, today, settings } = useAppData();
  const toast = useToast();
  const navigate = useNavigate();
  const m = props.meal;
  const r = recipeById.get(m.recipeId);
  const [servings, setServings] = useState(m.servings);
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
        {m.status !== 'cooked' && (
          <button className="btn btn-secondary w-full justify-start" onClick={() => run(() => setSkipped(m.id, m.status !== 'skipped'))}>
            {m.status === 'skipped' ? '↩️ Un-skip' : '⏭️ Skip this meal (keeps it off the shopping list)'}
          </button>
        )}
        <button className="btn btn-danger w-full justify-start" onClick={() => run(() => removeMeal(m.id), 'Removed from plan')}>
          🗑️ Remove from plan
        </button>
      </div>
    </Sheet>
  );
}
