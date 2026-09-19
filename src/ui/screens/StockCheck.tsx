// A guided pass through your kitchen: one ingredient at a time, answer how much you have or skip it.
// Skipped items go to the back of the queue so you can come back to them in the same sitting.
import { Check, Plus, Ruler, SkipForward, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatQty } from '../../domain/units';
import type { Ingredient, Location } from '../../domain/types';
import { addStock, setLooseLevel, updateIngredient } from '../../services/pantry';
import { markStockChecked, resetStockCheck } from '../../services/stockcheck';
import { AmountInput, EmptyState, PageHeader, Segmented } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';
import { UnitsEditor } from './UnitsEditor';

/** One package staged in the walkthrough, before it is written to the pantry. */
interface Pack {
  key: number;
  qty: number;
  location: Location;
}

export function StockCheck() {
  const d = useAppData();
  const toast = useToast();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [qty, setQty] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [location, setLocation] = useState<Location | null>(null);
  const [units, setUnits] = useState(false);

  // Everything the recipe book calls for, most-used first — the things worth knowing about.
  const queue = useMemo(() => {
    const uses = new Map<string, number>();
    for (const r of d.recipes) {
      if (r.archived) continue;
      for (const id of new Set(r.ingredients.map((i) => i.ingredientId))) uses.set(id, (uses.get(id) ?? 0) + 1);
    }
    const stocked = new Set(d.lots.map((l) => l.ingredientId));
    return [...uses.keys()]
      .map((id) => d.ingById.get(id))
      .filter((i): i is Ingredient => {
        if (!i || i.alwaysOnHand || d.stockChecked.has(i.id)) return false;
        return i.trackMode === 'exact' ? !stocked.has(i.id) : !d.looseById.has(i.id);
      })
      .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  }, [d.recipes, d.ingById, d.lots, d.looseById, d.stockChecked]);

  // Skipped items drop to the back rather than disappearing.
  const order = useMemo(() => {
    const s = new Set(skipped);
    return [...queue.filter((i) => !s.has(i.id)), ...queue.filter((i) => s.has(i.id))];
  }, [queue, skipped]);

  const ing = order[0];
  const left = order.length;
  const here: Location = location ?? ing?.defaultLocation ?? 'pantry';

  const next = () => {
    setQty(0);
    setPacks([]);
    setLocation(null);
  };
  const done = async (id: string, msg: string) => {
    await markStockChecked([id]);
    setAnswered((n) => n + 1);
    next();
    toast(msg);
  };

  if (!ing) {
    return (
      <>
        <PageHeader title="Stock check" back="/settings" />
        <EmptyState
          emoji="🎉"
          title="Kitchen's accounted for"
          body={answered ? `You answered for ${answered} ingredient${answered === 1 ? '' : 's'}.` : 'Nothing left to ask about right now.'}
          action={
            <button className="btn btn-secondary" onClick={async () => { await resetStockCheck(); setSkipped([]); toast('Starting over'); }}>
              Go through everything again
            </button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Stock check" subtitle={`${left} to go${answered ? ` · ${answered} done` : ''}`} back="/settings" />
      <div className="space-y-4 px-4">
        <div className="card p-4 text-center">
          <p className="text-sm text-stone-500">Do you have any…</p>
          <h2 className="mt-1 text-2xl font-semibold">{ing.name}</h2>
          <p className="mt-1 text-xs text-stone-400">Usually kept in the {ing.defaultLocation}</p>
        </div>

        {ing.trackMode === 'exact' ? (
          <div className="card space-y-3 p-4">
            {packs.length > 0 && (
              <ul className="divide-y divide-stone-100 rounded-xl bg-stone-50">
                {packs.map((p) => (
                  <li key={p.key} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-semibold">{formatQty(p.qty, ing, d.settings.units)}</span>
                    <span className="capitalize text-stone-500">in the {p.location}</span>
                    <button
                      className="icon-btn ml-auto h-8 w-8 text-red-600"
                      aria-label="Remove package"
                      onClick={() => setPacks(packs.filter((x) => x.key !== p.key))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {ing.packages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ing.packages.map((p) => (
                  <button key={p.label} className={`chip ${qty === p.qty ? 'chip-on' : ''}`} onClick={() => setQty(p.qty)}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            <AmountInput key={qty === 0 ? 'blank' : 'typed'} ing={ing} value={qty} onChange={setQty} autoFocus />

            <div>
              <span className="label">Where?</span>
              <Segmented<Location>
                value={here}
                options={[{ value: 'fridge', label: 'Fridge' }, { value: 'freezer', label: 'Freezer' }, { value: 'pantry', label: 'Pantry' }]}
                onChange={setLocation}
              />
            </div>

            <button
              className="btn btn-secondary w-full"
              disabled={qty <= 0}
              onClick={() => {
                setPacks([...packs, { key: Date.now(), qty, location: here }]);
                setQty(0);
              }}
            >
              <Plus size={18} /> Another package somewhere else
            </button>

            <button
              className="btn btn-primary w-full"
              disabled={qty <= 0 && packs.length === 0}
              onClick={async () => {
                const all = qty > 0 ? [...packs, { key: 0, qty, location: here }] : packs;
                for (const p of all) await addStock(ing.id, p.qty, { location: p.location, reason: 'adjust' });
                await done(ing.id, all.length > 1 ? `${ing.name}: ${all.length} packages added` : `${ing.name} added`);
              }}
            >
              <Check size={18} /> {packs.length > 0 ? "That's all of it" : 'I have this much'}
            </button>
            <button className="btn btn-secondary w-full" onClick={() => done(ing.id, `${ing.name} marked out`)}>
              I'm out of it
            </button>
            <button className="btn btn-ghost w-full text-sm" onClick={() => setUnits(true)}>
              <Ruler size={16} /> Units &amp; sizes for {ing.name.toLowerCase()}
            </button>
          </div>
        ) : (
          <div className="card space-y-2 p-4">
            {(['plenty', 'low', 'out'] as const).map((level) => (
              <button
                key={level}
                className={`btn w-full ${level === 'plenty' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={async () => {
                  await setLooseLevel(ing.id, level);
                  await done(ing.id, `${ing.name}: ${level}`);
                }}
              >
                {level === 'plenty' ? 'Plenty' : level === 'low' ? 'Running low' : 'Out'}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            className="btn btn-secondary flex-1"
            onClick={() => { setSkipped((s) => [...new Set([...s, ing.id])]); next(); }}
          >
            <SkipForward size={18} /> Skip for now
          </button>
          <button
            className="btn btn-secondary flex-1"
            onClick={async () => {
              await updateIngredient(ing.id, { alwaysOnHand: true });
              await done(ing.id, `${ing.name} won't be tracked`);
            }}
          >
            <X size={18} /> Don't track
          </button>
        </div>
        <p className="px-1 pb-6 text-center text-xs text-stone-400">
          Skipped items come back at the end of the list.
        </p>
      </div>
      {units && <UnitsEditor ing={ing} onClose={() => setUnits(false)} />}
    </>
  );
}
