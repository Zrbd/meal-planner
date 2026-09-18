import Fuse from 'fuse.js';
import { ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { db } from '../../db/schema';
import { CATEGORIES, categoryInfo, categoryOf, type CategoryId } from '../../domain/categories';
import { daysBetween, formatDay } from '../../domain/dates';
import { forecastItem } from '../../domain/forecast';
import type { Ingredient, ISODate, Location, LooseLevel, StockLot } from '../../domain/types';
import { formatQty } from '../../domain/units';
import { describeStock, openedStorage } from '../../domain/containers';
import { addStock, defaultExpiry, setLooseLevel } from '../../services/pantry';
import { addDaysISO as plusDays } from '../../domain/dates';
import { Lightbulb } from 'lucide-react';
import { AmountInput, EmptyState, IngredientPicker, PageHeader, SearchInput, Segmented, Sheet } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';

type Tab = 'all' | Location | 'spices' | 'staples';
const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'spices', label: 'Spices' },
  { value: 'staples', label: 'Staples' },
];

export function expiryLabel(expiresOn: ISODate | undefined, today: ISODate): { text: string; tone: string } | null {
  if (!expiresOn) return null;
  const n = daysBetween(today, expiresOn);
  if (n < 0) return { text: 'Expired', tone: 'text-red-600' };
  if (n === 0) return { text: 'Use today', tone: 'text-red-600' };
  if (n <= 2) return { text: `Use in ${n} day${n === 1 ? '' : 's'}`, tone: 'text-amber-600' };
  if (n <= 14) return { text: `Good ${n} days`, tone: 'text-stone-500' };
  return { text: `Good until ${formatDay(expiresOn, 'MMM d')}`, tone: 'text-stone-400' };
}

/** Group items by food category, in catalog order. */
function byCategory<T>(items: T[], ingOf: (t: T) => Ingredient): { id: CategoryId; items: T[] }[] {
  const groups = new Map<CategoryId, T[]>();
  for (const it of items) {
    const c = categoryOf(ingOf(it));
    groups.set(c, [...(groups.get(c) ?? []), it]);
  }
  return CATEGORIES.filter((c) => groups.has(c.id)).map((c) => ({ id: c.id, items: groups.get(c.id)! }));
}

export function Pantry() {
  const d = useAppData();
  const { ingredients, lots, today, settings, looseById } = d;
  const [params, setParams] = useSearchParams();
  // Kept in the URL so coming back from an item lands on the same tab.
  const tab = (TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'all') as Tab;
  const setTab = (t: Tab) => setParams(t === 'all' ? {} : { tab: t }, { replace: true });
  const [q, setQ] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [adding, setAdding] = useState<Ingredient | null>(null);

  const fuse = useMemo(() => new Fuse(ingredients, { keys: ['name', 'aliases'], threshold: 0.35, ignoreLocation: true }), [ingredients]);
  const matchIds = useMemo(() => (q.trim() ? new Set(fuse.search(q.trim()).map((r) => r.item.id)) : null), [q, fuse]);

  /** ingredientId → how many of this week's planned meals use it. */
  const weekUse = useMemo(() => {
    const end = plusDays(today, 6);
    const out = new Map<string, number>();
    for (const m of d.meals) {
      if (m.status !== 'planned' || m.leftoverOf || m.date < today || m.date > end) continue;
      const r = d.recipeById.get(m.recipeId);
      if (!r) continue;
      for (const id of new Set(r.ingredients.filter((i) => !i.optional).map((i) => i.ingredientId))) out.set(id, (out.get(id) ?? 0) + 1);
    }
    return out;
  }, [d.meals, d.recipeById, today]);

  /** Every ingredient any recipe in the book calls for — so the pantry lists them all, stocked or not. */
  const recipeUse = useMemo(
    () => new Set(d.recipes.filter((r) => !r.archived).flatMap((r) => r.ingredients.map((i) => i.ingredientId))),
    [d.recipes],
  );

  const exactItems = useMemo(() => {
    const byIng = new Map<string, StockLot[]>();
    for (const l of lots) if (tab === 'all' || tab === l.location) byIng.set(l.ingredientId, [...(byIng.get(l.ingredientId) ?? []), l]);
    for (const i of ingredients) {
      if (i.trackMode !== 'exact' || i.alwaysOnHand || byIng.has(i.id)) continue;
      const inTab = tab === 'all' || tab === i.defaultLocation;
      // staples you keep stocked, and anything this week's meals call for, show up even when you're out
      if (inTab && ((tab === 'all' && i.keepStocked) || weekUse.has(i.id) || recipeUse.has(i.id))) byIng.set(i.id, []);
    }
    return [...byIng]
      .map(([id, ls]) => ({ ing: d.ingById.get(id)!, lots: ls }))
      .filter((x) => x.ing && x.ing.trackMode === 'exact' && (!matchIds || matchIds.has(x.ing.id)))
      .map((x) => {
        const f = forecastItem(x.ing, lots, d.txns, undefined, today, d.now, settings.bufferDays);
        const soonest = x.lots.map((l) => l.expiresOn).filter(Boolean).sort()[0];
        return { ...x, forecast: f, soonest };
      })
      .sort((a, b) => (a.soonest ?? '9999').localeCompare(b.soonest ?? '9999') || a.ing.name.localeCompare(b.ing.name));
  }, [lots, tab, ingredients, d.ingById, d.txns, d.now, matchIds, today, settings.bufferDays, weekUse, recipeUse]);

  const looseItems = useMemo(() => {
    if (tab !== 'spices' && tab !== 'staples') return [];
    const usedInRecipes = new Set(d.recipes.filter((r) => !r.archived).flatMap((r) => r.ingredients.map((i) => i.ingredientId)));
    return ingredients
      .filter((i) => i.trackMode === 'loose' && !i.alwaysOnHand && (tab === 'spices') === (i.aisle === 'spices'))
      .filter((i) => (looseById.has(i.id) || usedInRecipes.has(i.id)) && (!matchIds || matchIds.has(i.id)))
      .sort((a, b) => Number(weekUse.has(b.id)) - Number(weekUse.has(a.id)) || a.name.localeCompare(b.name));
  }, [tab, ingredients, looseById, d.recipes, matchIds, weekUse]);

  const weekTag = (id: string) => {
    const n = weekUse.get(id);
    return n ? <span className="rounded-full bg-sky-100 px-1.5 text-[11px] font-semibold text-sky-800">{n} meal{n === 1 ? '' : 's'} this week</span> : null;
  };

  return (
    <>
      <PageHeader
        title="Pantry"
        subtitle={`${new Set(lots.map((l) => l.ingredientId)).size} items in stock`}
        right={
          <button className="btn btn-primary px-3 py-2" onClick={() => setPickOpen(true)}>
            <Plus size={18} /> Add
          </button>
        }
      />
      <div className="space-y-3 px-4">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {TABS.map((t) => (
            <button key={t.value} className={`chip ${tab === t.value ? 'chip-on' : ''}`} onClick={() => setTab(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search your kitchen" />

        {tab === 'spices' || tab === 'staples' ? (
          <>
            <p className="px-1 text-sm text-stone-500">
              {tab === 'spices' ? 'Spices' : 'Oils, sauces, and other staples'} aren't measured — just tell us when they're running low and they'll go on your list.
            </p>
            {looseItems.length === 0 && <EmptyState emoji="🧂" title="Nothing matches" />}
            {byCategory(looseItems, (i) => i).map((g) => (
              <section key={g.id}>
                {tab === 'staples' && <h2 className="section-title pt-1">{categoryInfo(g.id).label}</h2>}
                <ul className="card divide-y divide-stone-100">
                  {g.items.map((ing) => (
                    <li key={ing.id} className="flex items-center gap-3 p-3">
                      <Link to={`/pantry/${ing.id}`} className="min-w-0 flex-1">
                        <div className="truncate">{ing.name}</div>
                        {weekTag(ing.id)}
                      </Link>
                      <div className="w-44 shrink-0">
                        <Segmented<LooseLevel>
                          value={looseById.get(ing.id)?.level ?? ('' as LooseLevel)}
                          options={[{ value: 'plenty', label: 'Have' }, { value: 'low', label: 'Low' }, { value: 'out', label: 'Out' }]}
                          onChange={(v) => void setLooseLevel(ing.id, v)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        ) : exactItems.length === 0 ? (
          <EmptyState
            emoji="🧺"
            title={q ? 'Nothing matches' : 'Nothing here yet'}
            body="Add what's in your kitchen so we only put what you actually need on the shopping list. Items you buy through the shopping list are added automatically."
            action={<button className="btn btn-primary" onClick={() => setPickOpen(true)}><Plus size={18} /> Add items</button>}
          />
        ) : (
          byCategory(exactItems, (x) => x.ing).map((g) => (
            <section key={g.id}>
              <h2 className="section-title pt-1">{categoryInfo(g.id).emoji} {categoryInfo(g.id).label}</h2>
              <ul className="card divide-y divide-stone-100">
                {g.items.map(({ ing, lots: ls, forecast, soonest }) => {
                  const total = ls.reduce((s, l) => s + l.qty, 0);
                  const exp = expiryLabel(soonest, today);
                  const boughtDays = ls.length ? daysBetween(new Date(Math.min(...ls.map((l) => l.addedAt))).toLocaleDateString('en-CA'), today) : null;
                  return (
                    <li key={ing.id}>
                      <Link to={`/pantry/${ing.id}`} className="flex items-center gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="truncate font-medium">{ing.name}</span>
                            {total <= 0 && weekUse.has(ing.id) ? (
                              <span className="rounded-full bg-red-100 px-1.5 text-[11px] font-semibold text-red-700">Need for this week</span>
                            ) : (
                              <>
                                {forecast.status === 'out' && <span className="rounded-full bg-red-100 px-1.5 text-[11px] font-semibold text-red-700">Out</span>}
                                {forecast.status === 'low' && <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">Low</span>}
                              </>
                            )}
                            {weekTag(ing.id)}
                          </div>
                          <div className="text-xs text-stone-500">
                            {exp && <span className={exp.tone}>{exp.text}</span>}
                            {exp && boughtDays !== null && ' · '}
                            {boughtDays !== null && `bought ${boughtDays <= 0 ? 'today' : `${boughtDays}d ago`}`}
                          </div>
                        </div>
                        <span className="max-w-[45%] shrink-0 text-right text-sm font-semibold text-stone-700">{total > 0 ? describeStock(ls, ing, settings.units) : '—'}</span>
                        <ChevronRight size={18} className="shrink-0 text-stone-300" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      <IngredientPicker
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        title="What did you get?"
        onPick={(id) => {
          const ing = d.ingById.get(id);
          // a brand-new ingredient isn't in the live query yet; look it up after it lands
          if (ing) setAdding(ing);
          else setTimeout(() => setAddingById(id), 50);
        }}
      />
      {adding && <AddStockSheet ing={adding} onClose={() => setAdding(null)} />}
    </>
  );

  function setAddingById(id: string) {
    void db.ingredients.get(id).then((ing) => ing && setAdding(ing));
  }
}

export function AddStockSheet({ ing, onClose }: { ing: Ingredient; onClose: () => void }) {
  const { settings, today } = useAppData();
  const toast = useToast();
  const [qty, setQty] = useState(0);
  const [location, setLocation] = useState<Location>(ing.defaultLocation);
  const [expires, setExpires] = useState<string>(defaultExpiry(ing, ing.defaultLocation, today) ?? '');
  const [smart, setSmart] = useState(false);
  const [openedPkg, setOpenedPkg] = useState(false);
  const smartDays = (loc: Location) => ing.tipShelfLife?.[loc];
  const expiryFor = (loc: Location, useTip: boolean) => {
    const days = useTip ? smartDays(loc) : undefined;
    return days ? plusDays(today, days) : (defaultExpiry(ing, loc, today) ?? '');
  };

  if (ing.trackMode === 'loose') {
    return (
      <Sheet open onClose={onClose} title={ing.name}>
        <p className="mb-3 text-sm text-stone-500">We don't measure this one — just mark that you have it.</p>
        <button className="btn btn-primary w-full" onClick={async () => { await setLooseLevel(ing.id, 'plenty'); onClose(); toast(`${ing.name} marked as stocked`); }}>
          I have plenty
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Add ${ing.name.toLowerCase()}`}
      footer={
        <button
          className="btn btn-primary w-full"
          disabled={qty <= 0}
          onClick={async () => {
            await addStock(ing.id, qty, { location, expiresOn: expires || null, reason: 'adjust', opened: openedPkg });
            onClose();
            toast(`Added ${formatQty(qty, ing, settings.units)} ${ing.name.toLowerCase()}`);
          }}
        >
          Add to pantry
        </button>
      }
    >
      <div className="space-y-4">
        {ing.packages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ing.packages.map((p) => (
              <button key={p.label} className={`chip ${qty === p.qty ? 'chip-on' : ''}`} onClick={() => setQty(p.qty)}>
                {p.label}
              </button>
            ))}
          </div>
        )}
        <div>
          <span className="label">How much?</span>
          <AmountInput key={qty === 0 ? 'blank' : ing.packages.some((p) => p.qty === qty) ? `p${qty}` : 'typed'} ing={ing} value={qty} onChange={setQty} autoFocus={!ing.packages.length} />
        </div>
        <div>
          <span className="label">Where?</span>
          <Segmented<Location>
            value={location}
            options={[{ value: 'fridge', label: 'Fridge' }, { value: 'freezer', label: 'Freezer' }, { value: 'pantry', label: 'Pantry' }]}
            onChange={(v) => {
              setLocation(v);
              setExpires(expiryFor(v, smart));
            }}
          />
        </div>
        {ing.storageTip && (
          <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
            <div className="flex gap-2">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <p className="leading-relaxed">{ing.storageTip}</p>
            </div>
            {smartDays(location) && (
              <label className="mt-2 flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--color-brand)]"
                  checked={smart}
                  onChange={(e) => {
                    setSmart(e.target.checked);
                    setExpires(expiryFor(location, e.target.checked));
                  }}
                />
                I stored it this way (lasts ~{smartDays(location)} days)
              </label>
            )}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--color-brand)]"
            checked={openedPkg}
            onChange={(e) => {
              const on = e.target.checked;
              setOpenedPkg(on);
              if (!on) return setExpires(expiryFor(location, smart));
              const s = openedStorage(ing, { location, expiresOn: undefined }, today);
              setLocation(s.location);
              setExpires(s.expiresOn ?? expiryFor(s.location, smart));
            }}
          />
          It's already open (leftovers or a started package)
        </label>
        <div>
          <label className="label" htmlFor="exp">Use by <span className="text-stone-400">(estimated — change if the package says otherwise)</span></label>
          <input id="exp" type="date" className="input" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
      </div>
    </Sheet>
  );
}
