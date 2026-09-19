import { Check, ChevronDown, Search, Share, ShoppingBag, Wallet } from 'lucide-react';
import { Link } from 'react-router';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { aisleEmoji, aisleLabel } from '../../data/aisles';
import { addDaysISO, formatDay, nextShoppingDay, relativeDayLabel } from '../../domain/dates';
import { money, spending } from '../../domain/prices';
import { budgetStatus } from '../../domain/budget';
import { buildShoppingList, describeBuy, shoppingListText, type ShoppingLine } from '../../domain/shopping';
import type { Ingredient, UnitSystem } from '../../domain/types';
import { formatQty } from '../../domain/units';
import { addPackageSize, defaultExpiry } from '../../services/pantry';
import { addManualItem, clearChecked, patchShoppingState, removeShoppingState, setCheckedMany, toggleChecked } from '../../services/shopping';
import { finishTrip, undoTrip } from '../../services/trip';
import { storeById, storeSearchUrl } from '../../domain/stores';
import { AmountInput, EmptyState, PageHeader, Sheet } from '../components';
import { useAppData } from '../data';
import { usePrices } from '../hooks';
import { useToast } from '../toast';

/** Parse a typed price; blank or nonsense → undefined. */
const parsePrice = (s: string | undefined) => {
  const n = parseFloat((s ?? '').replace(/[^0-9.]/g, ''));
  return n > 0 ? Math.round(n * 100) / 100 : undefined;
};

/** One-line warning about extra perishables that would go bad. */
function wasteText(l: ShoppingLine, ing: Ingredient | undefined, units: UnitSystem): string {
  if (!l.waste || !ing) return '';
  const { qty, exact, useBy, fix } = l.waste;
  const fq = (n: number) => formatQty(n, ing, units);
  if (fix === 'loose') return `⚠️ ~${fq(qty)} would go bad — buy just ${fq(exact)} loose`;
  if (fix === 'freeze') return `❄️ Freeze the extra ~${fq(qty)} — nothing uses it by ${formatDay(useBy, 'EEE')}`;
  return `⚠️ ~${fq(qty)} extra goes bad by ${formatDay(useBy, 'EEE')} — plan a meal for it`;
}

export function Shopping() {
  const d = useAppData();
  const { today, settings, ingById, recipeById } = d;
  const toast = useToast();
  const prices = usePrices();
  const [params, setParams] = useSearchParams();
  const defaultTo = addDaysISO(nextShoppingDay(today, settings.shoppingDay), -1 + 7 * 0);
  const from = params.get('from') ?? today;
  const to = params.get('to') ?? (defaultTo > today ? defaultTo : addDaysISO(today, 6));
  const [rangeOpen, setRangeOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState<ShoppingLine | null>(null);
  const [manual, setManual] = useState('');
  const [showSkipped, setShowSkipped] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  /** Prices typed in the put-away sheet, by line key. */
  const [paid, setPaid] = useState<Record<string, string>>({});
  /** Amount actually bought (base units), when it differs from the suggested package. */
  const [bought, setBought] = useState<Record<string, number>>({});
  const [editingBought, setEditingBought] = useState<string | null>(null);

  const result = useMemo(
    () =>
      buildShoppingList({
        from, to, today, meals: d.meals, recipes: recipeById, ingredients: ingById, lots: d.lots, loose: d.loose,
        state: d.shopping, aisleOrder: settings.aisleOrder, bufferDays: settings.bufferDays, dailyRates: d.dailyRates,
      }),
    [from, to, today, d.meals, recipeById, ingById, d.lots, d.loose, d.shopping, settings.aisleOrder, settings.bufferDays, d.dailyRates],
  );
  const spent = useMemo(() => spending(d.trips, today), [d.trips, today]);
  const priceByKey = new Map(d.shopping.filter((s) => s.price).map((s) => [s.key, s.price!]));

  const buy = result.lines.filter((l) => l.section === 'buy');
  const check = result.lines.filter((l) => l.section === 'check');
  const skipped = result.lines.filter((l) => l.section === 'skipped');
  const checkedLines = [...buy, ...check].filter((l) => l.checked);
  const checkedCount = checkedLines.length;
  const remaining = buy.filter((l) => !l.checked).length;

  /** What a line should cost at the last price you paid. */
  const estimate = (l: ShoppingLine) => {
    const unit = l.ingredientId ? prices.get(l.ingredientId) : undefined;
    return unit !== undefined && l.buy > 0 ? unit * l.buy : undefined;
  };
  const listEstimate = buy.reduce((s, l) => s + (priceByKey.get(l.key) ?? estimate(l) ?? 0), 0);
  const budget = useMemo(
    () => budgetStatus({ trips: d.trips, today, budget: d.settings.weeklyBudget ?? 0, pending: listEstimate }),
    [d.trips, today, d.settings.weeklyBudget, listEstimate],
  );

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
    const price = priceByKey.get(l.key);
    const est = estimate(l);
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
          <div className="flex gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-stone-500">{!l.checked && reasonText(l)}</span>
            {price !== undefined ? (
              <span className="shrink-0 text-stone-600">{money(price)}</span>
            ) : est !== undefined && !l.checked ? (
              <span className="shrink-0 text-stone-400">~{money(est)}</span>
            ) : null}
          </div>
          {!l.checked && l.waste && <div className="truncate text-xs text-amber-700">{wasteText(l, ing, settings.units)}</div>}
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

  const openFinish = () => {
    setPaid(Object.fromEntries(checkedLines.map((l) => [l.key, priceByKey.get(l.key)?.toFixed(2) ?? ''])));
    setBought({});
    setEditingBought(null);
    setFinishOpen(true);
  };
  const paidTotal = checkedLines.reduce((s, l) => s + (parsePrice(paid[l.key]) ?? 0), 0);

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

        {(listEstimate > 0 || spent.total > 0) && (
          <div className="card grid grid-cols-3 divide-x divide-stone-100 py-2 text-center" aria-label="Spending">
            <div>
              <div className="text-xs text-stone-500">This list</div>
              <div className="font-semibold">{listEstimate > 0 ? `~${money(listEstimate)}` : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-stone-500">Last 7 days</div>
              <div className="font-semibold">{money(spent.week)}</div>
            </div>
            <div>
              <div className="text-xs text-stone-500">{formatDay(today, 'MMMM')}</div>
              <div className="font-semibold">{money(spent.month)}</div>
            </div>
          </div>
        )}

        {budget && (
          <Link to="/settings" className="card block p-3" aria-label="Weekly grocery budget">
            <div className="flex items-baseline justify-between text-sm">
              <span className="flex items-center gap-1.5 font-semibold"><Wallet size={15} className="text-stone-400" /> This week's budget</span>
              <span className={budget.over ? 'font-semibold text-red-700' : 'text-stone-500'}>
                {money(budget.spent)} of {money(budget.budget)}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
              <div
                className={`h-2 rounded-full ${budget.over ? 'bg-red-500' : budget.ratio > 0.8 ? 'bg-amber-500' : 'bg-brand'}`}
                style={{ width: `${Math.min(100, budget.ratio * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-stone-500">
              {budget.over
                ? `${money(budget.spent - budget.budget)} over. It resets on a rolling seven days, so it eases off as older trips fall out.`
                : budget.wouldBeOver
                  ? `This list would put you about ${money(budget.pending - budget.left)} over.`
                  : `${money(budget.left)} left — this list should come to about ${money(budget.pending)}.`}
            </p>
          </Link>
        )}

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
            <div className="px-1">
              <p className="text-sm text-stone-500">
                {remaining === 0 ? 'Everything ticked off 🎉' : `${remaining} item${remaining === 1 ? '' : 's'} left to get`}
                {buy.length > 0 && <span className="text-stone-400"> · {buy.length - remaining}/{buy.length}</span>}
              </p>
              {buy.length > 0 && (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-1.5 rounded-full bg-brand transition-all" style={{ width: `${((buy.length - remaining) / buy.length) * 100}%` }} />
                </div>
              )}
            </div>
            {groups.map(([aisle, lines]) => (
              <section key={aisle}>
                <div className="flex items-center justify-between pt-2">
                  <h2 className="section-title">{aisleEmoji(lines[0].aisle)} {aisleLabel(lines[0].aisle)}</h2>
                  <button
                    className="pb-1 text-xs font-semibold text-brand"
                    onClick={() => {
                      const all = lines.every((l) => l.checked);
                      void setCheckedMany(lines.map((l) => l.key), !all);
                    }}
                  >
                    {lines.every((l) => l.checked) ? 'Untick all' : 'Tick all'}
                  </button>
                </div>
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
            <button className="btn btn-primary w-full py-3.5 shadow-lg" onClick={openFinish}>
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
                const items = checkedLines.map((l) => ({
                  key: l.key, ingredientId: l.ingredientId, name: l.name, qty: l.manual ? 0 : (bought[l.key] ?? l.buy), price: parsePrice(paid[l.key]),
                }));
                const tripId = await finishTrip([from, to], items);
                setFinishOpen(false);
                toast(paidTotal > 0 ? `Pantry updated · spent ${money(paidTotal)}` : 'Pantry updated', { label: 'Undo', run: () => undoTrip(tripId) });
              }}
            >
              Add to pantry{paidTotal > 0 ? ` · ${money(paidTotal)}` : ''}
            </button>
          }
        >
          <p className="mb-2 text-sm text-stone-500">
            These go into your pantry with typical use-by dates. Add what you paid (optional) to track the cost of each meal and your grocery spending.
          </p>
          <ul className="divide-y divide-stone-100">
            {checkedLines.map((l) => {
              const ing = l.ingredientId ? ingById.get(l.ingredientId) : undefined;
              const useBy = ing && ing.trackMode === 'exact' ? defaultExpiry(ing, ing.defaultLocation, today) : undefined;
              const est = estimate(l);
              return (
                <li key={l.key} className="flex items-center gap-2 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{l.name}</div>
                    {ing && ing.trackMode === 'exact' ? (
                      <button
                        className="block max-w-full truncate text-left text-xs text-stone-500"
                        onClick={() => setEditingBought(editingBought === l.key ? null : l.key)}
                      >
                        <span className="font-medium text-brand underline decoration-dotted underline-offset-2">{formatQty(bought[l.key] ?? l.buy, ing, settings.units)}</span>
                        {` · ${ing.defaultLocation}`}
                        {useBy && ` · use by ${formatDay(useBy, 'MMM d')}`}
                      </button>
                    ) : (
                      <div className="truncate text-xs text-stone-500">{ing ? 'restocked' : '—'}</div>
                    )}
                    {ing && editingBought === l.key && (
                      <div className="mt-2">
                        <AmountInput ing={ing} value={bought[l.key] ?? l.buy} onChange={(v) => setBought({ ...bought, [l.key]: v })} autoFocus />
                        <p className="mt-1 text-xs text-stone-500">What was actually in the package you bought.</p>
                        {bought[l.key] !== undefined && bought[l.key] > 0 && !ing.packages.some((pk) => Math.abs(pk.qty - bought[l.key]) < 0.5) && (
                          <button
                            className="mt-1 text-xs font-semibold text-brand underline"
                            onClick={async () => {
                              const label = formatQty(bought[l.key], ing, settings.units);
                              await addPackageSize(ing.id, bought[l.key], label);
                              toast(`${label} added as a size you buy`);
                            }}
                          >
                            This is the size I usually buy — suggest it next time
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <label className="flex shrink-0 items-center gap-1 text-stone-400">
                    $
                    <input
                      className="input w-20 px-2 py-1 text-right text-sm"
                      inputMode="decimal"
                      aria-label={`Price paid for ${l.name}`}
                      placeholder={est !== undefined ? est.toFixed(2) : '0.00'}
                      value={paid[l.key] ?? ''}
                      onChange={(e) => setPaid({ ...paid, [l.key]: e.target.value })}
                      onBlur={() => void patchShoppingState(l.key, { price: parsePrice(paid[l.key]) })}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
          {paidTotal > 0 && <p className="mt-2 text-right text-sm font-semibold">Total {money(paidTotal)}</p>}
          <button className="btn btn-ghost mt-2 w-full text-sm" onClick={async () => { await clearChecked(); setFinishOpen(false); }}>
            Uncheck everything instead
          </button>
        </Sheet>
      )}
    </>
  );
}

function LineSheet({ line, onClose }: { line: ShoppingLine; onClose: () => void }) {
  const { ingById, recipeById, settings, today, shopping } = useAppData();
  const ing = line.ingredientId ? ingById.get(line.ingredientId) : undefined;
  const [qty, setQty] = useState(line.buy);
  const [price, setPrice] = useState(() => shopping.find((s) => s.key === line.key)?.price?.toFixed(2) ?? '');
  const fq = (n: number) => (ing ? formatQty(n, ing, settings.units) : String(n));
  const storeUrl = storeSearchUrl(settings.store, ing?.name ?? line.name);

  return (
    <Sheet open onClose={onClose} title={line.name}>
      <div className="space-y-4">
        {ing && ing.trackMode === 'exact' && (
          <div className="space-y-1 text-sm">
            {line.need > 0 && <div>Recipes need <b>{formatQty(line.need, ing, settings.units)}</b> more than you have.</div>}
            {line.packages.items.length > 0 && <div>Buying <b>{describeBuy(line, ing, settings.units)}</b>{line.leftover > 0 && <> — about {formatQty(line.leftover, ing, settings.units)} left over.</>}</div>}
          </div>
        )}
        {line.waste && ing && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {line.waste.fix === 'loose' && (
              <>About <b>{fq(line.waste.qty)}</b> of that would likely go bad before {formatDay(line.waste.useBy, 'EEEE')} — no planned meal uses it. Buy just <b>{fq(line.waste.exact)}</b> loose or from the counter instead.</>
            )}
            {line.waste.fix === 'freeze' && (
              <>No planned meal uses the extra ~{fq(line.waste.qty)} before it goes bad ({formatDay(line.waste.useBy, 'EEE, MMM d')}). Freeze it as soon as you get home.</>
            )}
            {line.waste.fix === 'plan' && (
              <>You'll have ~{fq(line.waste.qty)} extra that goes bad around {formatDay(line.waste.useBy, 'EEE, MMM d')}. Plan a meal that uses it, or look for a smaller size.</>
            )}
            {line.waste.fix === 'loose' && (
              <button className="btn btn-secondary mt-2 w-full" onClick={async () => { await patchShoppingState(line.key, { qtyOverride: line.waste!.exact }); onClose(); }}>
                Buy just {fq(line.waste.exact)}
              </button>
            )}
          </div>
        )}
        {line.reasons.some((r) => r.recipeId) && (
          <ul className="space-y-1 text-sm text-stone-600">
            {line.reasons.filter((r) => r.recipeId).map((r, i) => (
              <li key={i}>• {recipeById.get(r.recipeId!)?.title} — {relativeDayLabel(r.date!, today)}</li>
            ))}
          </ul>
        )}
        <label className="block">
          <span className="label">Price paid (optional)</span>
          <div className="flex items-center gap-2">
            <span className="text-stone-400">$</span>
            <input
              className="input"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={() => void patchShoppingState(line.key, { price: parsePrice(price) })}
            />
          </div>
        </label>
        {storeUrl && (
          <a className="btn btn-secondary w-full" href={storeUrl} target="_blank" rel="noopener noreferrer">
            <Search size={16} /> Find it at {storeById(settings.store)?.label}
          </a>
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
