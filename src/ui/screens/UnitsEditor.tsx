// Let the user define their own units and package sizes per ingredient (a can of broth, a head of garlic),
// plus how long an opened package keeps. No code changes needed for new kinds of containers.
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { openedLife } from '../../domain/containers';
import { LOCATIONS, type Ingredient, type Location, type UnitSystem } from '../../domain/types';
import { formatQty, isGlobalUnit, normalizeUnit, singularize } from '../../domain/units';
import { saveUnits } from '../../services/pantry';
import { AmountInput, Sheet } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';

interface Row {
  key: number;
  name: string;
  qty: number;
  /** Can be used in amounts ("2 cans"). */
  unit: boolean;
  /** A size you buy (suggested on the shopping list and when adding stock). */
  buy: boolean;
  locked: boolean;
}

/** Ingredient without its own units, so sizes are entered in cups/oz/g rather than in themselves. */
const plain = (ing: Ingredient): Ingredient => ({ ...ing, unitAliases: undefined, displayUnit: undefined });

export function unitsSummary(ing: Ingredient, system: UnitSystem): string {
  const p = plain(ing);
  const units = Object.entries(ing.unitAliases ?? {}).map(([n, v]) => `1 ${n} = ${formatQty(v, p, system)}`);
  const sizes = ing.packages.filter((pk) => !(ing.unitAliases ?? {})[pk.label]).map((pk) => pk.label);
  return [...units, ...sizes].join(' · ') || 'None yet';
}

export function UnitsEditor({ ing, onClose }: { ing: Ingredient; onClose: () => void }) {
  const { recipes } = useAppData();
  const toast = useToast();
  const base = useMemo(() => plain(ing), [ing]);
  const usedUnits = useMemo(() => {
    const s = new Set<string>();
    for (const r of recipes) for (const ri of r.ingredients) if (ri.ingredientId === ing.id) s.add(singularize(normalizeUnit(ri.unit)));
    return s;
  }, [recipes, ing.id]);

  const [rows, setRows] = useState<Row[]>(() => {
    let key = 0;
    const aliases = Object.entries(ing.unitAliases ?? {});
    const out: Row[] = aliases.map(([name, qty]) => ({
      key: key++, name, qty, unit: true, buy: ing.packages.some((p) => p.label === name), locked: usedUnits.has(singularize(name)),
    }));
    for (const p of ing.packages) if (!aliases.some(([n]) => n === p.label)) out.push({ key: key++, name: p.label, qty: p.qty, unit: false, buy: true, locked: false });
    return out;
  });
  const [displayUnit, setDisplayUnit] = useState(ing.displayUnit ?? '');
  const life = openedLife(ing);
  const firstLife = life ? (Object.entries(life)[0] as [Location, number] | undefined) : undefined;
  const [openLoc, setOpenLoc] = useState<Location>(firstLife?.[0] ?? 'fridge');
  const [openDays, setOpenDays] = useState(firstLife ? String(firstLife[1]) : '');
  const [error, setError] = useState('');

  const patch = (key: number, p: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const save = async () => {
    const clean = rows.map((r) => ({ ...r, name: r.unit ? r.name.trim().toLowerCase() : r.name.trim() }));
    const names = clean.map((r) => r.name.toLowerCase());
    if (clean.some((r) => !r.name)) return setError('Give every size a name.');
    if (clean.some((r) => r.qty <= 0)) return setError('Every size needs an amount.');
    if (new Set(names).size !== names.length) return setError('Two sizes have the same name.');
    const clash = clean.find((r) => r.unit && isGlobalUnit(r.name));
    if (clash) return setError(`"${clash.name}" is already a standard unit. Try something like "can" or "bag".`);
    const unitAliases = Object.fromEntries(clean.filter((r) => r.unit).map((r) => [r.name, r.qty]));
    const days = Number(openDays);
    await saveUnits(ing.id, {
      unitAliases,
      packages: clean.filter((r) => r.buy).map((r) => ({ label: r.name, qty: r.qty })),
      displayUnit: displayUnit || undefined,
      openedShelfLife: days > 0 ? { [openLoc]: days } : undefined,
    });
    toast('Units saved');
    onClose();
  };

  const unitNames = rows.filter((r) => r.unit && r.name.trim()).map((r) => r.name.trim().toLowerCase());

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${ing.name}: units & sizes`}
      footer={<button className="btn btn-primary w-full" onClick={() => void save()}>Save</button>}
    >
      <div className="space-y-4">
        <p className="text-sm text-stone-500">
          Name the containers and pieces you buy or cook with — a can, a head, a bag. The pantry then shows sealed packages
          separately from what's open, and opened ones get their own use-by date.
        </p>
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.key} className="card space-y-2 p-3">
              <div className="flex items-center gap-2">
                <input
                  className="input min-w-0 flex-1"
                  placeholder="Name, e.g. can"
                  value={r.name}
                  disabled={r.locked}
                  aria-label="Size name"
                  onChange={(e) => patch(r.key, { name: e.target.value })}
                />
                <button
                  className="icon-btn h-9 w-9 shrink-0 text-red-600 disabled:opacity-30"
                  aria-label="Remove size"
                  disabled={r.locked}
                  onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div>
                <span className="label">One {r.name.trim() || 'of these'} holds</span>
                <AmountInput ing={base} value={r.qty} onChange={(v) => patch(r.key, { qty: v })} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-5 w-5 accent-[var(--color-brand)]" checked={r.unit} disabled={r.locked} onChange={(e) => patch(r.key, { unit: e.target.checked })} />
                  Use in amounts ("2 {r.name.trim() || 'cans'}")
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-5 w-5 accent-[var(--color-brand)]" checked={r.buy} onChange={(e) => patch(r.key, { buy: e.target.checked })} />
                  I buy it this size
                </label>
              </div>
              {r.locked && <p className="text-xs text-stone-400">Recipes use this unit, so its name stays. You can still change the size.</p>}
            </li>
          ))}
        </ul>
        <button
          className="btn btn-secondary w-full"
          onClick={() => setRows([...rows, { key: Math.max(0, ...rows.map((r) => r.key)) + 1, name: '', qty: 0, unit: true, buy: true, locked: false }])}
        >
          <Plus size={18} /> Add a size
        </button>

        <div className="flex items-center gap-3">
          <span className="flex-1 text-sm font-medium">Show amounts in</span>
          <select className="input w-auto px-2 py-1.5" value={displayUnit} onChange={(e) => setDisplayUnit(e.target.value)}>
            <option value="">Automatic</option>
            {unitNames.map((n) => <option key={n} value={n}>{n}s</option>)}
          </select>
        </div>

        <div>
          <span className="label">Once opened, it keeps</span>
          <div className="flex items-center gap-2">
            <input className="input w-20 text-center" inputMode="numeric" placeholder="—" value={openDays} onChange={(e) => setOpenDays(e.target.value.replace(/[^\d]/g, ''))} aria-label="Days once opened" />
            <span className="text-sm">days in the</span>
            <select className="input w-auto px-2 py-1.5 capitalize" value={openLoc} onChange={(e) => setOpenLoc(e.target.value as Location)}>
              {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <p className="mt-1 text-xs text-stone-400">Leave blank if opening it doesn't change how long it lasts.</p>
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </Sheet>
  );
}
