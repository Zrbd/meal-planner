// Feature 6: the "is the big one actually cheaper" calculator. Shelf tags are supposed to answer
// this and half of them are per-ounce while the one beside it is per-100-count.
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { comparePrices, comparisonUnit, describeSize, effectivePerBase, formatPerUnit, usableFraction, type PriceOption } from '../../domain/unitprice';
import { toBase } from '../../domain/units';
import type { Ingredient } from '../../domain/types';
import { IngredientPicker, PageHeader, unitName } from '../components';
import { useAppData } from '../data';

let counter = 0;
const blank = (): PriceOption => ({ id: `o${(counter += 1)}`, label: '', price: 0, qty: 0, unit: '' });

export function PriceCompare() {
  const { ingById, settings, dailyRates } = useAppData();
  const [ingId, setIngId] = useState<string>('');
  const [options, setOptions] = useState<PriceOption[]>([blank(), blank()]);
  const [picking, setPicking] = useState(false);

  const ing: Ingredient | undefined = ingById.get(ingId);
  const units = ing ? unitChoices(ing) : [];
  const filled = options.map((o) => ({ ...o, unit: o.unit || units[0] || ing?.baseUnit || '' }));
  const result = ing ? comparePrices(filled, ing, settings.units) : undefined;
  const rate = dailyRates.get(ingId) ?? 0;

  return (
    <>
      <PageHeader title="Which is cheaper?" subtitle={ing ? ing.name : 'Pick an item, enter the shelf prices'} back />
      <div className="space-y-4 px-4 pb-8">
        <div className="card p-4">
          <div className="label">What are you buying?</div>
          <button className="input text-left" onClick={() => setPicking(true)}>
            {ing ? ing.name : <span className="text-stone-400">Choose an item…</span>}
          </button>
        </div>
        <IngredientPicker
          open={picking}
          onClose={() => setPicking(false)}
          title="Compare prices for"
          onPick={(id) => {
            setIngId(id);
            setOptions([blank(), blank()]);
            setPicking(false);
          }}
        />

        {ing && (
          <>
            {filled.map((o, i) => (
              <div key={o.id} className="card space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    placeholder={`Option ${i + 1}, e.g. “store brand”`}
                    value={o.label}
                    onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  />
                  {options.length > 2 && (
                    <button className="icon-btn" aria-label="Remove" onClick={() => setOptions((os) => os.filter((_, j) => j !== i))}>
                      <X size={18} />
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <label className="flex-1">
                    <span className="label">Price ($)</span>
                    <input
                      className="input"
                      inputMode="decimal"
                      value={o.price || ''}
                      onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) || 0 } : x)))}
                    />
                  </label>
                  <label className="flex-1">
                    <span className="label">Size</span>
                    <input
                      className="input"
                      inputMode="decimal"
                      value={o.qty || ''}
                      onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) || 0 } : x)))}
                    />
                  </label>
                  <label className="w-28">
                    <span className="label">Unit</span>
                    <select
                      className="input"
                      value={o.unit}
                      onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))}
                    >
                      {units.map((u) => (
                        <option key={u} value={u}>
                          {unitName(u)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}

            <button className="btn btn-secondary w-full" onClick={() => setOptions((os) => [...os, blank()])}>
              <Plus size={18} /> Another option
            </button>

            {result && result.rows.length > 1 && (
              <div className="card p-4">
                <div className="section-title pt-0">Per {comparisonUnit(ing, settings.units)}</div>
                <ul className="divide-y divide-stone-100">
                  {result.rows.map((row) => {
                    const base = toBase(row.option.qty, row.option.unit, ing);
                    const usable = usableFraction(base, rate, ing.shelfLife?.pantry ?? ing.shelfLife?.fridge);
                    const effective = effectivePerBase(row.perBase, usable);
                    return (
                      <li key={row.option.id} className="flex items-baseline justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {row.option.label || describeSize(ing, base, row.option.unit)}
                            {row.best && <span className="ml-2 text-xs font-semibold text-brand">best</span>}
                          </div>
                          <div className="text-xs text-stone-500">
                            ${row.option.price.toFixed(2)} · {describeSize(ing, base, row.option.unit)}
                            {usable < 0.95 && ` · you'd likely use ${Math.round(usable * 100)}% of it`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold tabular-nums">{formatPerUnit(row.perDisplay, result.displayUnit)}</div>
                          {!row.best && <div className="text-xs text-red-600">+{Math.round(row.premium * 100)}%</div>}
                          {usable < 0.95 && effective !== row.perBase && (
                            <div className="text-[11px] text-amber-600">waste-adjusted worse</div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {result.spread > 0 && (
                  <p className="mt-2 text-sm text-stone-600">
                    The best option saves{' '}
                    <span className="font-semibold">{formatPerUnit(result.spread, result.displayUnit)}</span> against the worst.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** Units worth offering for this ingredient: its own, plus the ones shelf tags use. */
function unitChoices(ing: Ingredient): string[] {
  const extra = ing.baseUnit === 'g' ? ['g', 'kg', 'oz', 'lb'] : ing.baseUnit === 'ml' ? ['ml', 'l', 'fl oz', 'qt'] : ['ea'];
  return [...new Set([...extra, ...Object.keys(ing.unitAliases ?? {})])];
}
