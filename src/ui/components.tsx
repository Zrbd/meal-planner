import Fuse from 'fuse.js';
import { ChevronLeft, Clock, Heart, Minus, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router';
import { AISLES, aisleEmoji, aisleLabel } from '../data/aisles';
import type { Coverage } from '../domain/coverage';
import { parseQuantity } from '../domain/parse';
import { round3 } from '../domain/stock';
import type { AisleId, BaseUnit, Ingredient, Location, Recipe } from '../domain/types';
import { displayQty, toBase, unitLabel, unitsFor } from '../domain/units';
import { createIngredient } from '../services/pantry';
import { useAppData } from './data';

// ---------- layout ----------

export function PageHeader(props: { title: string; subtitle?: string; back?: boolean | string; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="pt-safe sticky top-0 z-20 bg-ground/90 backdrop-blur">
      <div className="flex h-14 items-center gap-1 px-3">
        {props.back && (
          <button
            aria-label="Back"
            className="icon-btn"
            onClick={() => (typeof props.back === 'string' ? navigate(props.back) : navigate(-1))}
          >
            <ChevronLeft size={26} />
          </button>
        )}
        <div className={`min-w-0 flex-1 ${props.back ? '' : 'pl-1'}`}>
          <h1 className="truncate text-xl leading-tight font-bold">{props.title}</h1>
          {props.subtitle && <p className="truncate text-xs text-stone-500">{props.subtitle}</p>}
        </div>
        {props.right}
      </div>
    </header>
  );
}

export function Sheet(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { open, onClose } = props;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={props.title}>
      <div className="animate-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="animate-up pb-safe relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-xl">
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          <h2 className="flex-1 text-lg font-bold">{props.title}</h2>
          <button className="icon-btn -mr-2" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{props.children}</div>
        {props.footer && <div className="border-t border-stone-100 px-5 py-3">{props.footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function EmptyState(props: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-12 text-center">
      <div className="mb-3 text-5xl">{props.emoji}</div>
      <h2 className="text-lg font-semibold">{props.title}</h2>
      {props.body && <p className="mt-1 text-sm text-stone-500">{props.body}</p>}
      {props.action && <div className="mt-4">{props.action}</div>}
    </div>
  );
}

export function Segmented<T extends string>(props: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-stone-100 p-1">
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => props.onChange(o.value)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
            props.value === o.value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <label className="relative block">
      <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-stone-400" />
      <input
        className="input pl-9"
        type="search"
        value={props.value}
        autoFocus={props.autoFocus}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

// ---------- quantities ----------

export const unitName = (u: string) => (u === 'ea' ? 'count' : unitLabel(u, 2));
const trimNum = (n: number) => String(Math.round(n * 100) / 100);
const stepFor = (u: string) => (u === 'g' || u === 'ml' ? 50 : 1);

/** Number + unit input that reports the value in the ingredient's base unit. */
export function AmountInput(props: { ing: Ingredient; value: number; onChange: (base: number) => void; autoFocus?: boolean }) {
  const { settings } = useAppData();
  const { ing, onChange } = props;
  const start = displayQty(props.value, ing, settings.units);
  const [unit, setUnit] = useState(start.unit);
  const [text, setText] = useState(props.value > 0 ? trimNum(start.qty) : '');
  const units = useMemo(() => {
    const u = unitsFor(ing);
    return u.includes(start.unit) ? u : [start.unit, ...u];
  }, [ing, start.unit]);

  const emit = (t: string, u: string) => {
    const q = parseQuantity(t.trim());
    onChange(q ? round3(toBase(q.qty, u, ing)) : 0);
  };
  const step = (dir: number) => {
    const cur = parseQuantity(text.trim())?.qty ?? 0;
    const next = Math.max(0, cur + dir * stepFor(unit));
    const t = trimNum(next);
    setText(t);
    emit(t, unit);
  };

  return (
    <div className="flex items-stretch gap-2">
      <button type="button" className="btn btn-secondary px-3" aria-label="Less" onClick={() => step(-1)}>
        <Minus size={18} />
      </button>
      <input
        className="input min-w-0 text-center"
        inputMode="decimal"
        placeholder="0"
        value={text}
        autoFocus={props.autoFocus}
        aria-label={`Amount of ${ing.name}`}
        onChange={(e) => {
          setText(e.target.value);
          emit(e.target.value, unit);
        }}
      />
      <button type="button" className="btn btn-secondary px-3" aria-label="More" onClick={() => step(1)}>
        <Plus size={18} />
      </button>
      <select
        className="input w-auto"
        value={unit}
        aria-label="Unit"
        onChange={(e) => {
          setUnit(e.target.value);
          emit(text, e.target.value);
        }}
      >
        {units.map((u) => (
          <option key={u} value={u}>
            {unitName(u)}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------- ingredients ----------

export function IngredientPicker(props: {
  open: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  title?: string;
  initialQuery?: string;
}) {
  const { ingredients } = useAppData();
  const { open, initialQuery = '' } = props;
  const [q, setQ] = useState(initialQuery);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (open) {
      setQ(initialQuery);
      setCreating(false);
    }
  }, [open, initialQuery]);

  const fuse = useMemo(
    () => new Fuse(ingredients, { keys: [{ name: 'name', weight: 2 }, 'aliases'], threshold: 0.35, ignoreLocation: true }),
    [ingredients],
  );
  const results = useMemo(
    () =>
      q.trim()
        ? fuse.search(q.trim()).slice(0, 40).map((r) => r.item)
        : [...ingredients].sort((a, b) => a.name.localeCompare(b.name)),
    [q, fuse, ingredients],
  );
  const pick = (id: string) => {
    props.onPick(id);
    props.onClose();
  };

  return (
    <Sheet open={open} onClose={props.onClose} title={creating ? 'New ingredient' : props.title ?? 'Choose an ingredient'}>
      {creating ? (
        <NewIngredientForm initialName={q} onCancel={() => setCreating(false)} onCreated={pick} />
      ) : (
        <>
          <div className="sticky top-0 z-10 bg-white pb-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search ingredients" autoFocus />
          </div>
          {q.trim() && (
            <button className="btn btn-ghost w-full justify-start px-1" onClick={() => setCreating(true)}>
              <Plus size={18} /> Add “{q.trim()}” as a new ingredient
            </button>
          )}
          <ul className="divide-y divide-stone-100">
            {results.map((i) => (
              <li key={i.id}>
                <button className="flex w-full items-center gap-3 py-3 text-left" onClick={() => pick(i.id)}>
                  <span className="text-xl">{aisleEmoji(i.aisle)}</span>
                  <span className="flex-1">{i.name}</span>
                  <span className="text-xs text-stone-400">{aisleLabel(i.aisle)}</span>
                </button>
              </li>
            ))}
          </ul>
          {!q.trim() && (
            <button className="btn btn-ghost mt-2 w-full" onClick={() => setCreating(true)}>
              <Plus size={18} /> Add a new ingredient
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}

const MEASURES: { value: BaseUnit; label: string }[] = [
  { value: 'ea', label: 'Count' },
  { value: 'g', label: 'Weight' },
  { value: 'ml', label: 'Volume' },
];

export function NewIngredientForm(props: { initialName: string; onCreated: (id: string) => void; onCancel: () => void }) {
  const n = props.initialName.trim();
  const [name, setName] = useState(n ? n[0].toUpperCase() + n.slice(1) : '');
  const [baseUnit, setBaseUnit] = useState<BaseUnit>('ea');
  const [aisle, setAisle] = useState<AisleId>('produce');
  const [location, setLocation] = useState<Location>('fridge');
  const [loose, setLoose] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = await createIngredient({
        name: name.trim(), aliases: [], aisle, baseUnit, packages: [],
        // density 1 lets weight/volume items still accept cups/tbsp approximately
        density: baseUnit === 'ea' ? undefined : 1,
        shelfLife: { pantry: 365, fridge: 7, freezer: 120 },
        defaultLocation: location, trackMode: loose ? 'loose' : 'exact', keepStocked: false, valueWeight: 2,
      });
      props.onCreated(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="new-ing-name">Name</label>
        <input id="new-ing-name" className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <span className="label">How do you measure it?</span>
        <Segmented value={baseUnit} options={MEASURES} onChange={setBaseUnit} />
        <p className="mt-1 text-xs text-stone-500">
          {baseUnit === 'ea' ? 'Things you count: eggs, onions, cans.' : baseUnit === 'g' ? 'Things you weigh: meat, cheese, flour.' : 'Liquids: milk, broth, sauces.'}
        </p>
      </div>
      <div>
        <span className="label">Where do you keep it?</span>
        <Segmented
          value={location}
          options={[{ value: 'fridge', label: 'Fridge' }, { value: 'freezer', label: 'Freezer' }, { value: 'pantry', label: 'Pantry' }]}
          onChange={setLocation}
        />
      </div>
      <div>
        <label className="label" htmlFor="new-ing-aisle">Store aisle</label>
        <select id="new-ing-aisle" className="input" value={aisle} onChange={(e) => setAisle(e.target.value as AisleId)}>
          {AISLES.map((a) => (
            <option key={a.id} value={a.id}>{a.emoji} {a.label}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-3">
        <input type="checkbox" className="h-5 w-5 accent-green-700" checked={loose} onChange={(e) => setLoose(e.target.checked)} />
        <span className="text-sm">Don't track exact amounts (like spices — just plenty / low / out)</span>
      </label>
      <div className="flex gap-2">
        <button className="btn btn-secondary flex-1" onClick={props.onCancel}>Back</button>
        <button className="btn btn-primary flex-1" disabled={!name.trim() || busy} onClick={save}>Add ingredient</button>
      </div>
    </div>
  );
}

// ---------- recipes ----------

const TITLE_EMOJI: [RegExp, string][] = [
  [/taco|fajita|quesadilla/i, '🌮'], [/burger/i, '🍔'], [/pizza/i, '🍕'], [/burrito|enchilada|wrap/i, '🌯'],
  [/pancake|waffle|french toast/i, '🥞'], [/soup|noodle|ramen|pad thai|pho|stew/i, '🍜'],
  [/spaghetti|pasta|ziti|scampi|lasagna|mac|penne|linguine|fettuccine/i, '🍝'], [/salad/i, '🥗'],
  [/curry|masala|korma/i, '🍛'], [/risotto|fried rice|rice/i, '🍚'], [/sandwich|sub\b|panini/i, '🥪'],
  [/chili/i, '🌶️'], [/stuffed.*pepper/i, '🫑'], [/oat|granola|yogurt/i, '🥣'], [/mushroom/i, '🍄'],
  [/cake|cookie|brownie|muffin|pie\b/i, '🧁'], [/steak/i, '🥩'], [/shakshuka|egg/i, '🍳'],
];
const PROTEIN_EMOJI: Record<string, string> = {
  chicken: '🍗', pork: '🥓', fish: '🐟', shrimp: '🍤', turkey: '🦃', egg: '🍳', beans: '🫘', vegetarian: '🥦',
};
export function recipeEmoji(r: Recipe): string {
  for (const [re, e] of TITLE_EMOJI) if (re.test(r.title)) return e;
  if (r.protein && PROTEIN_EMOJI[r.protein]) return PROTEIN_EMOJI[r.protein];
  return r.slots.includes('breakfast') ? '🥞' : '🍽️';
}

const GRADIENTS = [
  'from-amber-100 to-orange-200', 'from-lime-100 to-green-200', 'from-rose-100 to-red-200', 'from-sky-100 to-cyan-200',
  'from-yellow-100 to-amber-200', 'from-emerald-100 to-teal-200', 'from-orange-100 to-rose-200', 'from-violet-100 to-fuchsia-200',
];
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Your photo of the dish if you took one, otherwise the generated emoji tile. */
export function RecipeThumb({ recipe, className = 'h-16 w-16 text-3xl' }: { recipe: Recipe; className?: string }) {
  const { photoByRecipe } = useAppData();
  const photo = photoByRecipe.get(recipe.id);
  if (photo) {
    return <img src={photo.thumb} alt="" aria-hidden className={`shrink-0 rounded-xl object-cover ${className}`} />;
  }
  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${GRADIENTS[hash(recipe.id) % GRADIENTS.length]} ${className}`}
    >
      {recipeEmoji(recipe)}
    </div>
  );
}

/** "In season" marker used on recipe cards and ingredient rows. */
export function SeasonBadge({ label = 'In season', className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-lime-100 px-2 py-0.5 text-[11px] font-semibold text-lime-800 ${className}`}>
      🌿 {label}
    </span>
  );
}

export const totalTime = (r: Recipe) => r.prepMin + r.cookMin;

export function CoverageBadge({ coverage }: { coverage: Coverage }) {
  if (coverage.canMake)
    return <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">Have everything</span>;
  const n = coverage.missing.length;
  const tone = coverage.ratio >= 0.6 ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600';
  return <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>Need {n} item{n === 1 ? '' : 's'}</span>;
}

export function RecipeCard(props: { recipe: Recipe; coverage?: Coverage; to?: string; right?: ReactNode; subtitle?: ReactNode }) {
  const r = props.recipe;
  return (
    <Link to={props.to ?? `/recipes/${r.id}`} className="card flex items-center gap-3 p-3 active:bg-stone-50">
      <RecipeThumb recipe={r} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{r.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
          {props.subtitle ?? (
            <>
              <Clock size={12} /> {totalTime(r)} min <span>·</span> <span className="truncate">{r.cuisine}</span>
            </>
          )}
          {r.favorite && <Heart size={12} className="shrink-0 fill-red-500 text-red-500" />}
        </div>
        {props.coverage && <CoverageBadge coverage={props.coverage} />}
      </div>
      {props.right}
    </Link>
  );
}
