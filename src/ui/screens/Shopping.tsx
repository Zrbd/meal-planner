import { Check, ChevronDown, Share, ShoppingBag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { aisleEmoji, aisleLabel } from '../../data/aisles';
import { addDaysISO, formatDay, nextShoppingDay, relativeDayLabel } from '../../domain/dates';
import { buildShoppingList, describeBuy, shoppingListText, type ShoppingLine } from '../../domain/shopping';
import { formatQty } from '../../domain/units';
import { addManualItem, clearChecked, patchShoppingState, removeShoppingState, toggleChecked } from '../../services/shopping';
import { finishTrip, undoTrip } from '../../services/trip';
import { AmountInput, EmptyState, PageHeader, Sheet } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';

export function Shopping() {
  const d = useAppData();
  const { today, settings, ingById, recipeById } = d;
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const defaultTo = addDaysISO(nextShoppingDay(today, settings.shoppingDay), -1 + 7 * 0);
  const from = params.get('from') ?? today;
  const to = params.get('to') ?? (defaultTo > today ? defaultTo : addDaysISO(today, 6));
  const [rangeOpen, setRangeOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState<ShoppingLine | null>(null);
  const [manual, setManual] = useState('');
  const [showSkipped, setShowSkipped] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);

  const result = useMemo(
    () =>
      buildShoppingList({
        from, to, today, meals: d.meals, recipes: recipeById, ingredients: ingById, lots: d.lots, loose: d.loose,
        state: d.shopping, aisleOrder: settings.aisleOrder, bufferDays: settings.bufferDays, dailyRates: d.dailyRates,
      }),
    [from, to, today, d.meals, recipeById, ingById, d.lots, d.loose, d.shopping, settings.aisleOrder, settings.bufferDays, d.dailyRates],
  );

  const buy = result.lines.filter((l) => l.section === 'buy');
  const check = result.lines.filter((l) => l.section === 'check');
  const skipped = result.lines.filter((l) => l.section === 'skipped');
  const checkedCount = [...buy, ...check].filter((l) => l.checked).length;
  const remaining = buy.filter((l) => !l.checked).length;

  const setRange = (f: string, t: string) => {
    setParams({ from: f, to: t }, { replace: true });
    setRangeOpen(false);
  };

  const share = async () => {
    const header = `Shopping list · ${formatDay(from, 'MMM d')}–${formatDay(to, 'MMM d')}`;
    const text = `${header}\n${shoppingListText(result.lines, ingById, settings.units, aisleLabel)}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast('List copied');
      }
    } catch {
      /* cancelled */
    }
  };

  const reasonText = (l: ShoppingLine) => {
    const meals = l.reasons.filter((r) => r.kind === 'meal' || r.kind === 'loose');
    const titles = [...new Set(meals.map((r) => recipeById.get(r.recipeId ?? '')?.title).filter(Boolean))];
    if (l.reasons.some((r) => r.kind === 'restock') && !titles.length) return 'Running low — you keep this stocked';
    if (!titles.length) return '';
    return titles.length <= 2 ? `For ${titles.join(' & ')}` : `For ${titles.length} meals`;
  };

  const renderLine = (l: ShoppingLine) => {
    const ing = l.ingredientId ? ingById.get(l.ingredientId) : undefined;
    const amount = describeBuy(l, ing, settings.units);
    return (
      <li key={l.key} className="flex items-center gap-1">
        <button
          className="flex h-12 w-12 shrink-0 items-center justify-center"
          aria-label={l.checked ? `Uncheck ${l.name}` : `Check ${l.name}`}
          onClick={() => void toggleChecked(l.key)}
        >
          <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${l.checked ? 'border-brand bg-brand text-white' : 'border-stone-300'}`}>
            {l.checked && <Check size={15} strokeWidth={3} />}
          </span>
        </button>
        <button className="min-w-0 flex-1 py-2.5 pr-3 text-left" onClick={() => setLineOpen(l)}>
          <div className={`flex items-baseline gap-2 ${l.checked ? 'text-stone-400 line-through' : ''}`}>
            <span className="truncate font-medium">{l.name}</span>
            <span className="ml-auto shrink-0 text-sm font-semibold">{amount}</span>
          </div>
          {!l.checked && reasonText(l) && <div className="truncate text-xs text-stone-500">{reasonText(l)}</div>}
        </button>
      </li>
    );
  };

  const groups: [string, ShoppingLine[]][] = [];
  for (const l of buy) {
    const last = groups[groups.length - 1];
    if (last && last[0] === l.aisle) last[1].push(l);
    else groups.push([l.aisle, [l]]);
  }

  return (
    <>
      <PageHeader
        title="Shopping list"
        right={
          <button className="icon-btn" aria-label="Share list" onClick={share} disabled={!buy.length}>
            <Share size={21} />
          </button>
        }
      />
      <div className="space-y-3 px-4 pb-24">
        <button className="card flex w-full items-center gap-3 p-3 text-left" onClick={() => setRangeOpen(true)}>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{relativeDayLabel(from, today)} → {relativeDayLabel(to, today)}</div>
            <div className="text-xs text-stone-500">
              Covers {result.mealIds.length} planned meal{result.mealIds.length === 1 ? '' : 's'} · already subtracts what's in your pantry
            </div>
          </div>
          <ChevronDown size={18} className="text-stone-400" />
        </button>

        {result.errors.length > 0 && (
          <div className="card border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            Some amounts couldn't be converted: {result.errors.slice(0, 3).join('; ')}
          </div>
        )}

        {buy.length === 0 && check.length === 0 ? (
          <EmptyState
            emoji={result.mealIds.length ? '🎉' : '🛒'}
            title={result.mealIds.length ? 'You have everything!' : 'Nothing to buy yet'}
            body={result.mealIds.length ? 'Your pantry covers every planned meal in this range.' : 'Plan some meals and the list builds itself.'}
          />
        ) : (
          <>
            <p className="px-1 text-sm text-stone-500">{remaining} item{remaining === 1 ? '' : 's'} left to get</p>
            {groups.map(([aisle, lines]) => (
              <section key={aisle}>
                <h2 className="section-title pt-2">{aisleEmoji(lines[0].aisle)} {aisleLabel(lines[0].aisle)}</h2>
                <ul className="card divide-y divide-stone-100">{lines.map(renderLine)}</ul>
              </section>
            ))}
            {check.length > 0 && (
              <section>
                <h2 className="section-title pt-2">🔍 Check your cupboard</h2>
                <p className="-mt-1 px-1 pb-2 text-xs text-stone-500">Spices and staples marked low that these meals use.</p>
                <ul className="card divide-y divide-stone-100">{check.map(renderLine)}</ul>
              </section>
            )}
          </>
        )}

        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!manual.trim()) return;
            await addManualItem(manual.trim());
            setManual('');
          }}
        >
          <input className="input" placeholder="Add something else (paper towels…)" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="btn btn-secondary" disabled={!manual.trim()}>Add</button>
        </form>

        {skipped.length > 0 && (
          <section>
            <button className="section-title flex w-full items-center gap-1" onClick={() => setShowSkipped(!showSkipped)}>
              Already have ({skipped.length}) <ChevronDown size={14} className={showSkipped ? 'rotate-180' : ''} />
            </button>
            {showSkipped && (
              <ul className="card divide-y divide-stone-100">
                {skipped.map((l) => (
                  <li key={l.key} className="flex items-center justify-between p-3">
                    <span className="text-stone-500">{l.name}</span>
                    <button className="btn btn-ghost px-2 py-1 text-sm" onClick={() => void patchShoppingState(l.key, { haveIt: false })}>Need it</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {d.trips[0] && d.now - d.trips[0].finishedAt < 3 * 86_400_000 && (
          <p className="text-center text-xs text-stone-400">
            Last trip added {d.trips[0].lines.length} items to your pantry.{' '}
            <button className="text-brand underline" onClick={async () => { await undoTrip(d.trips[0].id); toast('Trip undone'); }}>Undo</button>
          </p>
        )}
      </div>

      {checkedCount > 0 && (
        <div className="fixed inset-x-0 z-20 bottom-safe-tab">
          <div className="mx-auto max-w-xl px-4">
            <button className="btn btn-primary w-full py-3.5 shadow-lg" onClick={() => setFinishOpen(true)}>
              <ShoppingBag size={18} /> Done shopping · put {checkedCount} item{checkedCount === 1 ? '' : 's'} away
            </button>
          </div>
        </div>
      )}

      <Sheet open={rangeOpen} onClose={() => setRangeOpen(false)} title="Shop for…">
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-secondary" onClick={() => setRange(today, addDaysISO(today, 2))}>Next 3 days</button>
          <button className="btn btn-secondary" onClick={() => setRange(today, addDaysISO(today, 6))}>Next 7 days</button>
          <button className="btn btn-secondary col-span-2" onClick={() => setRange(today, addDaysISO(nextShoppingDay(today, settings.shoppingDay), -1))}>
            Until next shopping day ({formatDay(nextShoppingDay(today, settings.shoppingDay), 'EEE')})
          </button>
          <button className="btn btn-secondary col-span-2" onClick={() => setRange(nextShoppingDay(today, settings.shoppingDay), addDaysISO(nextShoppingDay(today, settings.shoppingDay), 6))}>
            Next shopping week
          </button>
        </div>
        <h3 className="section-title">Custom</h3>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="label">From</span>
            <input type="date" className="input" value={from} onChange={(e) => e.target.value && setParams({ from: e.target.value, to: e.target.value > to ? e.target.value : to }, { replace: true })} />
          </label>
          <label>
            <span className="label">To</span>
            <input type="date" className="input" value={to} min={from} onChange={(e) => e.target.value && setParams({ from, to: e.target.value }, { replace: true })} />
          </label>
        </div>
      </Sheet>

      {lineOpen && <LineSheet line={lineOpen} onClose={() => setLineOpen(null)} />}

      {finishOpen && (
        <Sheet
          open
          onClose={() => setFinishOpen(false)}
          title="Put groceries away"
          footer={
            <button
              className="btn btn-primary w-full"
              onClick={async () => {
                const items = [...buy, ...check].filter((l) => l.checked).map((l) => ({
                  key: l.key, ingredientId: l.ingredientId, name: l.name, qty: l.manual ? 0 : l.buy,
                }));
                const tripId = await finishTrip([from, to], items);
                setFinishOpen(false);
                toast('Pantry updated', { label: 'Undo', run: () => undoTrip(tripId) });
              }}
            >
              Add to pantry
            </button>
          }
        >
          <p className="mb-2 text-sm text-stone-500">These go into your pantry with typical use-by dates. You can adjust amounts or dates later in Pantry.</p>
          <ul className="divide-y divide-stone-100">
            {[...buy, ...check].filter((l) => l.checked).map((l) => {
              const ing = l.ingredientId ? ingById.get(l.ingredientId) : undefined;
              return (
                <li key={l.key} className="flex justify-between py-2 text-sm">
                  <span>{l.name}</span>
                  <span className="text-stone-500">{ing ? (ing.trackMode === 'loose' ? 'restocked' : `${formatQty(l.buy, ing, settings.units)} · ${ing.defaultLocation}`) : '—'}</span>
                </li>
              );
            })}
          </ul>
          <button className="btn btn-ghost mt-2 w-full text-sm" onClick={async () => { await clearChecked(); setFinishOpen(false); }}>
            Uncheck everything instead
          </button>
        </Sheet>
      )}
    </>
  );
}

function LineSheet({ line, onClose }: { line: ShoppingLine; onClose: () => void }) {
  const { ingById, recipeById, settings, today } = useAppData();
  const ing = line.ingredientId ? ingById.get(line.ingredientId) : undefined;
  const [qty, setQty] = useState(line.buy);

  return (
    <Sheet open onClose={onClose} title={line.name}>
      <div className="space-y-4">
        {ing && ing.trackMode === 'exact' && (
          <div className="space-y-1 text-sm">
            {line.need > 0 && <div>Recipes need <b>{formatQty(line.need, ing, settings.units)}</b> more than you have.</div>}
            {line.packages.items.length > 0 && <div>Buying <b>{describeBuy(line, ing, settings.units)}</b>{line.leftover > 0 && <> — about {formatQty(line.leftover, ing, settings.units)} left over.</>}</div>}
          </div>
        )}
        {line.reasons.some((r) => r.recipeId) && (
          <ul className="space-y-1 text-sm text-stone-600">
            {line.reasons.filter((r) => r.recipeId).map((r, i) => (
              <li key={i}>• {recipeById.get(r.recipeId!)?.title} — {relativeDayLabel(r.date!, today)}</li>
            ))}
          </ul>
        )}
        {!line.manual && (
          <button className="btn btn-secondary w-full" onClick={async () => { await patchShoppingState(line.key, { haveIt: true, checked: false }); onClose(); }}>
            I already have this
          </button>
        )}
        {ing && ing.trackMode === 'exact' && (
          <div>
            <span className="label">Buy a different amount</span>
            <AmountInput ing={ing} value={qty} onChange={setQty} />
            <div className="mt-2 flex gap-2">
              {line.overridden && (
                <button className="btn btn-ghost flex-1" onClick={async () => { await patchShoppingState(line.key, { qtyOverride: undefined }); onClose(); }}>
                  Reset
                </button>
              )}
              <button className="btn btn-primary flex-1" disabled={qty <= 0} onClick={async () => { await patchShoppingState(line.key, { qtyOverride: qty }); onClose(); }}>
                Save amount
              </button>
            </div>
          </div>
        )}
        {line.manual && (
          <button className="btn btn-danger w-full" onClick={async () => { await removeShoppingState(line.key); onClose(); }}>
            Remove from list
          </button>
        )}
      </div>
    </Sheet>
  );
}
