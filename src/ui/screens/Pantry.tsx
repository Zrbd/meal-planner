import Fuse from 'fuse.js';
import { ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { aisleEmoji } from '../../data/aisles';
import { db } from '../../db/schema';
import { daysBetween, formatDay } from '../../domain/dates';
import { forecastItem } from '../../domain/forecast';
import type { Ingredient, ISODate, Location, LooseLevel } from '../../domain/types';
import { formatQty } from '../../domain/units';
import { addStock, defaultExpiry, setLooseLevel } from '../../services/pantry';
import { AmountInput, EmptyState, IngredientPicker, PageHeader, SearchInput, Segmented, Sheet } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';

type Tab = 'all' | Location | 'spices';

export function expiryLabel(expiresOn: ISODate | undefined, today: ISODate): { text: string; tone: string } | null {
  if (!expiresOn) return null;
  const n = daysBetween(today, expiresOn);
  if (n < 0) return { text: 'Expired', tone: 'text-red-600' };
  if (n === 0) return { text: 'Use today', tone: 'text-red-600' };
  if (n <= 2) return { text: `Use in ${n} day${n === 1 ? '' : 's'}`, tone: 'text-amber-600' };
  if (n <= 14) return { text: `Good ${n} days`, tone: 'text-stone-500' };
  return { text: `Good until ${formatDay(expiresOn, 'MMM d')}`, tone: 'text-stone-400' };
}

export function Pantry() {
  const d = useAppData();
  const { ingredients, lots, today, settings, looseById } = d;
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [adding, setAdding] = useState<Ingredient | null>(null);

  const fuse = useMemo(() => new Fuse(ingredients, { keys: ['name', 'aliases'], threshold: 0.35, ignoreLocation: true }), [ingredients]);
  const matchIds = useMemo(() => (q.trim() ? new Set(fuse.search(q.trim()).map((r) => r.item.id)) : null), [q, fuse]);

  const exactItems = useMemo(() => {
    const byIng = new Map<string, typeof lots>();
    for (const l of lots) if (tab === 'all' || tab === l.location) byIng.set(l.ingredientId, [...(byIng.get(l.ingredientId) ?? []), l]);
    // staples you keep stocked show up even when you're out
    if (tab === 'all') for (const i of ingredients) if (i.keepStocked && i.trackMode === 'exact' && !byIng.has(i.id)) byIng.set(i.id, []);
    return [...byIng]
      .map(([id, ls]) => ({ ing: d.ingById.get(id)!, lots: ls }))
      .filter((x) => x.ing && x.ing.trackMode === 'exact' && (!matchIds || matchIds.has(x.ing.id)))
      .map((x) => {
        const f = forecastItem(x.ing, lots, d.txns, undefined, today, d.now, settings.bufferDays);
        const soonest = x.lots.map((l) => l.expiresOn).filter(Boolean).sort()[0];
        return { ...x, forecast: f, soonest };
      })
      .sort((a, b) => (a.soonest ?? '9999').localeCompare(b.soonest ?? '9999') || a.ing.name.localeCompare(b.ing.name));
  }, [lots, tab, ingredients, d.ingById, d.txns, d.now, matchIds, today, settings.bufferDays]);

  const looseItems = useMemo(() => {
    const usedInRecipes = new Set(d.recipes.filter((r) => !r.archived).flatMap((r) => r.ingredients.map((i) => i.ingredientId)));
    return ingredients
      .filter((i) => i.trackMode === 'loose' && !i.alwaysOnHand && (looseById.has(i.id) || usedInRecipes.has(i.id)) && (!matchIds || matchIds.has(i.id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients, looseById, d.recipes, matchIds]);

  const tabs: { value: Tab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'fridge', label: 'Fridge' },
    { value: 'freezer', label: 'Freezer' },
    { value: 'pantry', label: 'Pantry' },
    { value: 'spices', label: 'Spices' },
  ];

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
        <Segmented value={tab} options={tabs} onChange={setTab} />
        <SearchInput value={q} onChange={setQ} placeholder="Search your kitchen" />

        {tab === 'spices' ? (
          <>
            <p className="px-1 text-sm text-stone-500">
              Spices and staples aren't measured — just tell us when they're running low and they'll go on your list.
            </p>
            <ul className="card divide-y divide-stone-100">
              {looseItems.map((ing) => (
                <li key={ing.id} className="flex items-center gap-3 p-3">
                  <Link to={`/pantry/${ing.id}`} className="min-w-0 flex-1 truncate">{ing.name}</Link>
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
          </>
        ) : exactItems.length === 0 ? (
          <EmptyState
            emoji="🧺"
            title={q ? 'Nothing matches' : 'Nothing here yet'}
            body="Add what's in your kitchen so we only put what you actually need on the shopping list. Items you buy through the shopping list are added automatically."
            action={<button className="btn btn-primary" onClick={() => setPickOpen(true)}><Plus size={18} /> Add items</button>}
          />
        ) : (
          <ul className="card divide-y divide-stone-100">
            {exactItems.map(({ ing, lots: ls, forecast, soonest }) => {
              const total = ls.reduce((s, l) => s + l.qty, 0);
              const exp = expiryLabel(soonest, today);
              return (
                <li key={ing.id}>
                  <Link to={`/pantry/${ing.id}`} className="flex items-center gap-3 p-3">
                    <span className="text-xl">{aisleEmoji(ing.aisle)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{ing.name}</span>
                        {forecast.status === 'out' && <span className="rounded-full bg-red-100 px-1.5 text-[11px] font-semibold text-red-700">Out</span>}
                        {forecast.status === 'low' && <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">Low</span>}
                      </div>
                      {exp && <div className={`text-xs ${exp.tone}`}>{exp.text}</div>}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-stone-700">{total > 0 ? formatQty(total, ing, settings.units) : '—'}</span>
                    <ChevronRight size={18} className="shrink-0 text-stone-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
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
            await addStock(ing.id, qty, { location, expiresOn: expires || null, reason: 'adjust' });
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
              setExpires(defaultExpiry(ing, v, today) ?? '');
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="exp">Use by <span className="text-stone-400">(estimated — change if the package says otherwise)</span></label>
          <input id="exp" type="date" className="input" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
      </div>
    </Sheet>
  );
}
