import { Snowflake, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { aisleLabel } from '../../data/aisles';
import { CATEGORIES, categoryInfo, categoryOf, type CategoryId } from '../../domain/categories';
import { formatDay, relativeDayLabel } from '../../domain/dates';
import { forecastItem } from '../../domain/forecast';
import { LOCATIONS, type Location, type LooseLevel } from '../../domain/types';
import { formatQty } from '../../domain/units';
import { moveLot, ranOut, setAmount, setLooseLevel, tossLot, updateIngredient, updateLot, useSome } from '../../services/pantry';
import { AmountInput, EmptyState, PageHeader, Segmented, Sheet } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';
import { AddStockSheet, expiryLabel } from './Pantry';
import { StorageTip } from '../amounts';

const REASON: Record<string, string> = { purchase: 'Bought', cook: 'Cooked with', adjust: 'Adjusted', waste: 'Tossed' };

export function PantryItem() {
  const { id = '' } = useParams();
  const d = useAppData();
  const { ingById, lots, txns, today, now, settings, looseById, recipes } = d;
  const toast = useToast();
  const ing = ingById.get(id);
  const [sheet, setSheet] = useState<null | 'add' | 'used' | 'set' | 'threshold'>(null);
  const [amt, setAmt] = useState(0);

  if (!ing) {
    return (
      <>
        <PageHeader title="Pantry" back="/pantry" />
        <EmptyState emoji="🤷" title="Item not found" />
      </>
    );
  }

  const myLots = lots.filter((l) => l.ingredientId === id).sort((a, b) => (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999'));
  const f = forecastItem(ing, lots, txns, looseById.get(id), today, now, settings.bufferDays);
  const q = (n: number) => formatQty(n, ing, settings.units);
  const history = txns.filter((t) => t.ingredientId === id).sort((a, b) => b.at - a.at).slice(0, 8);
  const usedIn = recipes.filter((r) => !r.archived && r.ingredients.some((i) => i.ingredientId === id));

  return (
    <>
      <PageHeader title={ing.name} subtitle={`${categoryInfo(categoryOf(ing)).emoji} ${categoryInfo(categoryOf(ing)).label} · ${aisleLabel(ing.aisle)} aisle`} back />
      <div className="space-y-4 px-4 pb-8">
        {ing.trackMode === 'loose' ? (
          <div className="card space-y-3 p-4">
            <div className="text-sm text-stone-500">How much is left?</div>
            <Segmented<LooseLevel>
              value={looseById.get(id)?.level ?? ('' as LooseLevel)}
              options={[{ value: 'plenty', label: 'Plenty' }, { value: 'low', label: 'Running low' }, { value: 'out', label: 'Out' }]}
              onChange={(v) => void setLooseLevel(id, v)}
            />
          </div>
        ) : (
          <div className="card p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm text-stone-500">On hand</div>
                <div className="text-3xl font-bold">{f.onHand > 0 ? q(f.onHand) : 'None'}</div>
              </div>
              {f.status !== 'ok' && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${f.status === 'out' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                  {f.status === 'out' ? 'Out' : 'Running low'}
                </span>
              )}
            </div>
            {f.rate > 0 && (
              <p className="mt-2 text-sm text-stone-600">
                You use about <b>{q(f.rate * 7)}</b> a week.
                {f.runOutOn && f.onHand > 0 && <> At that pace it runs out around <b>{relativeDayLabel(f.runOutOn, today)}</b>.</>}
              </p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button className="btn btn-primary px-2" onClick={() => setSheet('add')}>Add</button>
              <button className="btn btn-secondary px-2" disabled={f.onHand <= 0} onClick={() => { setAmt(0); setSheet('used'); }}>Used some</button>
              <button className="btn btn-secondary px-2" onClick={() => { setAmt(f.onHand); setSheet('set'); }}>Set amount</button>
            </div>
            {f.onHand > 0 && (
              <button className="btn btn-ghost mt-2 w-full text-sm" onClick={async () => { await ranOut(id); toast(`Marked ${ing.name.toLowerCase()} as used up`); }}>
                I ran out
              </button>
            )}
          </div>
        )}

        {(ing.storageTip || ing.thawTip) && <StorageTip ing={ing} open />}

        {myLots.length > 0 && (
          <section>
            <h2 className="section-title pt-0">Packages</h2>
            <ul className="card divide-y divide-stone-100">
              {myLots.map((l) => {
                const exp = expiryLabel(l.expiresOn, today);
                return (
                  <li key={l.id} className="space-y-2 p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{q(l.qty)}</span>
                      {exp && <span className={`text-xs ${exp.tone}`}>· {exp.text}</span>}
                      <span className="ml-auto text-xs text-stone-400">bought {formatDay(new Date(l.addedAt).toLocaleDateString('en-CA'), 'MMM d')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select className="input w-auto px-2 py-1.5 text-sm capitalize" value={l.location} aria-label="Location" onChange={(e) => void moveLot(l.id, e.target.value as Location)}>
                        {LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                      </select>
                      <input type="date" className="input min-w-0 flex-1 px-2 py-1.5 text-sm" aria-label="Use by" value={l.expiresOn ?? ''} onChange={(e) => void updateLot(l.id, { expiresOn: e.target.value || undefined })} />
                      {l.location !== 'freezer' && ing.shelfLife.freezer && (
                        <button className="icon-btn h-9 w-9 shrink-0 text-sky-600" aria-label="Freeze" onClick={() => void moveLot(l.id, 'freezer').then(() => toast('Moved to freezer'))}>
                          <Snowflake size={18} />
                        </button>
                      )}
                      <button className="icon-btn h-9 w-9 shrink-0 text-red-600" aria-label="Toss" onClick={() => void tossLot(l.id).then(() => toast('Tossed'))}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section>
          <h2 className="section-title pt-0">Settings</h2>
          <div className="card divide-y divide-stone-100">
            <label className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <div className="font-medium">Always keep stocked</div>
                <div className="text-xs text-stone-500">Add to the shopping list when it runs low, even if no meal needs it.</div>
              </div>
              <input type="checkbox" className="h-6 w-6 accent-green-700" checked={ing.keepStocked} onChange={(e) => void updateIngredient(id, { keepStocked: e.target.checked })} />
            </label>
            {ing.trackMode === 'exact' && (
              <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => { setAmt(ing.lowThreshold ?? f.threshold); setSheet('threshold'); }}>
                <div className="flex-1">
                  <div className="font-medium">"Low" means less than</div>
                  <div className="text-xs text-stone-500">{ing.lowThreshold === undefined ? 'Automatic, based on how fast you use it' : 'Set by you'}</div>
                </div>
                <span className="text-sm font-semibold">{f.threshold > 0 ? q(f.threshold) : '—'}</span>
              </button>
            )}
            <div className="flex items-center gap-3 p-3">
              <div className="flex-1 font-medium">Category</div>
              <select className="input w-auto px-2 py-1.5" value={categoryOf(ing)} onChange={(e) => void updateIngredient(id, { category: e.target.value as CategoryId })}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 p-3">
              <div className="flex-1 font-medium">Usually kept in</div>
              <select className="input w-auto px-2 py-1.5 capitalize" value={ing.defaultLocation} onChange={(e) => void updateIngredient(id, { defaultLocation: e.target.value as Location })}>
                {LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <div className="font-medium">Just track plenty / low / out</div>
                <div className="text-xs text-stone-500">Good for spices, oils, and things you don't want to measure.</div>
              </div>
              <input type="checkbox" className="h-6 w-6 accent-green-700" checked={ing.trackMode === 'loose'} onChange={(e) => void updateIngredient(id, { trackMode: e.target.checked ? 'loose' : 'exact' })} />
            </label>
          </div>
        </section>

        {history.length > 0 && (
          <section>
            <h2 className="section-title pt-0">Recent activity</h2>
            <ul className="card divide-y divide-stone-100 text-sm">
              {history.map((t) => (
                <li key={t.id} className="flex justify-between p-3">
                  <span>{REASON[t.reason]} · {relativeDayLabel(new Date(t.at).toLocaleDateString('en-CA'), today)}</span>
                  <span className={t.delta > 0 ? 'text-green-700' : 'text-stone-500'}>{t.delta > 0 ? '+' : '−'}{q(Math.abs(t.delta))}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {usedIn.length > 0 && (
          <section>
            <h2 className="section-title pt-0">Used in {usedIn.length} recipe{usedIn.length === 1 ? '' : 's'}</h2>
            <div className="flex flex-wrap gap-2">
              {usedIn.slice(0, 12).map((r) => <Link key={r.id} to={`/recipes/${r.id}`} className="chip">{r.title}</Link>)}
            </div>
          </section>
        )}
      </div>

      {sheet === 'add' && <AddStockSheet ing={ing} onClose={() => setSheet(null)} />}
      {(sheet === 'used' || sheet === 'set' || sheet === 'threshold') && (
        <Sheet
          open
          onClose={() => setSheet(null)}
          title={sheet === 'used' ? 'How much did you use?' : sheet === 'set' ? 'How much do you have?' : 'Warn me when below'}
          footer={
            <div className="flex gap-2">
              {sheet === 'threshold' && ing.lowThreshold !== undefined && (
                <button className="btn btn-secondary flex-1" onClick={async () => { await updateIngredient(id, { lowThreshold: undefined }); setSheet(null); }}>Automatic</button>
              )}
              <button
                className="btn btn-primary flex-[2]"
                onClick={async () => {
                  if (sheet === 'used') await useSome(id, amt);
                  else if (sheet === 'set') await setAmount(id, amt);
                  else await updateIngredient(id, { lowThreshold: amt });
                  setSheet(null);
                }}
              >
                Save
              </button>
            </div>
          }
        >
          <AmountInput ing={ing} value={amt} onChange={setAmt} autoFocus />
        </Sheet>
      )}
    </>
  );
}
