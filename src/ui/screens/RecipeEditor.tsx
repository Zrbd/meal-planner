// Add / edit a recipe. Two ways in: type it (form) or paste it (text is parsed into the form).
// Ingredient lines are matched to the ingredient catalog so the pantry and shopping list work.
import { AlertTriangle, ClipboardPaste, GripVertical, Plus, Trash2, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { createIngredientMatcher, parseIngredientLine, parseQuantity, parseRecipeText, type ParsedLine } from '../../domain/parse';
import { SLOTS, type Recipe, type Slot } from '../../domain/types';
import { canConvert, COMMON_UNITS, normalizeUnit, unitsFor } from '../../domain/units';
import { updateIngredient } from '../../services/pantry';
import { saveRecipe } from '../../services/recipes';
import { IngredientPicker, PageHeader, Segmented, unitName } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';

interface Row {
  key: number;
  ingredientId?: string;
  name: string; // text as typed/pasted, used to help match
  qty: string;
  unit: string;
  prep: string;
  optional: boolean;
}

let rowKey = 1;
const blankRow = (): Row => ({ key: rowKey++, name: '', qty: '', unit: 'ea', prep: '', optional: false });

const fmtQty = (n: number) => (n > 0 ? String(Math.round(n * 1000) / 1000) : '');

function rowFromParsed(p: ParsedLine): Row {
  return {
    key: rowKey++, ingredientId: p.ingredientId, name: p.name, qty: fmtQty(p.qty),
    unit: p.unit || 'ea', prep: p.prep ?? '', optional: p.optional,
  };
}

const CUISINES = ['American', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'Thai', 'Greek', 'Middle Eastern', 'French', 'Korean', 'Russian', 'Other'];
const PROTEINS = ['', 'chicken', 'beef', 'pork', 'turkey', 'fish', 'shrimp', 'egg', 'beans', 'vegetarian'];
const DIETS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'];

interface Form {
  title: string;
  description: string;
  servings: string;
  prepMin: string;
  cookMin: string;
  difficulty: '1' | '2' | '3';
  cuisine: string;
  protein: string;
  diet: string[];
  slots: Slot[];
  rows: Row[];
  steps: string[];
  notes: string;
}

function formFromRecipe(r: Recipe): Form {
  return {
    title: r.title, description: r.description, servings: String(r.baseServings), prepMin: String(r.prepMin),
    cookMin: String(r.cookMin), difficulty: String(r.difficulty) as Form['difficulty'], cuisine: r.cuisine,
    protein: r.protein ?? '', diet: r.diet, slots: r.slots,
    rows: r.ingredients.map((i) => ({
      key: rowKey++, ingredientId: i.ingredientId, name: '', qty: fmtQty(i.qty), unit: i.unit, prep: i.prep ?? '', optional: !!i.optional,
    })),
    steps: r.steps.length ? r.steps : [''], notes: r.notes ?? '',
  };
}

const emptyForm = (): Form => ({
  title: '', description: '', servings: '4', prepMin: '15', cookMin: '30', difficulty: '1', cuisine: 'American',
  protein: '', diet: [], slots: ['dinner'], rows: [blankRow(), blankRow(), blankRow()], steps: ['', ''], notes: '',
});

export function RecipeEditor({ importMode = false }: { importMode?: boolean }) {
  const { id } = useParams();
  const { recipeById, ingredients } = useAppData();
  const existing = id ? recipeById.get(id) : undefined;
  const [form, setForm] = useState<Form>(() => (existing ? formFromRecipe(existing) : emptyForm()));
  const [pasteText, setPasteText] = useState('');
  const [stage, setStage] = useState<'paste' | 'form'>(importMode ? 'paste' : 'form');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const matcher = useMemo(() => createIngredientMatcher(ingredients), [ingredients]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setRow = (key: number, patch: Partial<Row>) =>
    setForm((f) => ({ ...f, rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  const doParse = () => {
    const p = parseRecipeText(pasteText, matcher);
    setForm((f) => ({
      ...f,
      title: p.title || f.title,
      description: p.description,
      servings: p.servings ? String(p.servings) : f.servings,
      prepMin: p.prepMin !== undefined ? String(p.prepMin) : f.prepMin,
      cookMin: p.cookMin !== undefined ? String(p.cookMin) : f.cookMin,
      rows: p.ingredients.length ? p.ingredients.map(rowFromParsed) : f.rows,
      steps: p.steps.length ? p.steps : f.steps,
    }));
    setStage('form');
  };

  const addBulk = () => {
    const parsed = bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => rowFromParsed(parseIngredientLine(l, matcher)));
    setForm((f) => ({ ...f, rows: [...f.rows.filter((r) => r.ingredientId || r.name.trim() || r.qty), ...parsed] }));
    setBulkText('');
    setBulkOpen(false);
  };

  // ---- validation ----
  const filledRows = form.rows.filter((r) => r.ingredientId || r.name.trim() || r.qty.trim());
  const rowProblem = (r: Row): string | undefined => {
    if (!r.ingredientId) return 'Pick which ingredient this is';
    const ing = ingredients.find((i) => i.id === r.ingredientId);
    if (!ing) return 'Unknown ingredient';
    if (r.qty.trim() && !parseQuantity(r.qty.trim())) return 'Amount should be a number like 2, 1/2, or 1.5';
    if (!canConvert(r.unit, ing)) return 'unit';
    return undefined;
  };
  const steps = form.steps.map((s) => s.trim()).filter(Boolean);
  const problems: string[] = [];
  if (!form.title.trim()) problems.push('Give your recipe a name.');
  if (!filledRows.length) problems.push('Add at least one ingredient.');
  if (filledRows.some((r) => rowProblem(r))) problems.push('Fix the highlighted ingredients.');
  if (!steps.length) problems.push('Add at least one step.');
  if (!form.slots.length) problems.push('Choose at least one meal (breakfast, lunch, dinner).');

  const save = async () => {
    setTried(true);
    if (problems.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setBusy(true);
    try {
      const num = (s: string, d: number) => {
        const n = parseQuantity(s.trim())?.qty;
        return n !== undefined && n >= 0 ? n : d;
      };
      const newId = await saveRecipe({
        id: existing?.id,
        favorite: existing?.favorite,
        archived: existing?.archived,
        rating: existing?.rating,
        title: form.title.trim(),
        description: form.description.trim(),
        baseServings: Math.max(1, Math.round(num(form.servings, 4))),
        prepMin: Math.round(num(form.prepMin, 0)),
        cookMin: Math.round(num(form.cookMin, 0)),
        difficulty: Number(form.difficulty) as 1 | 2 | 3,
        cuisine: form.cuisine.trim() || 'Other',
        protein: form.protein || undefined,
        diet: form.diet,
        slots: SLOTS.filter((s) => form.slots.includes(s)),
        ingredients: filledRows.map((r) => ({
          ingredientId: r.ingredientId!, qty: parseQuantity(r.qty.trim())?.qty ?? 0, unit: normalizeUnit(r.unit),
          prep: r.prep.trim() || undefined, optional: r.optional || undefined,
        })),
        steps,
        notes: form.notes.trim() || undefined,
      });
      toast(existing ? 'Recipe saved' : 'Recipe added to your collection');
      navigate(`/recipes/${newId}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const title = existing ? 'Edit recipe' : importMode ? 'Paste a recipe' : 'New recipe';

  if (stage === 'paste') {
    return (
      <>
        <PageHeader title={title} back />
        <div className="space-y-3 px-4">
          <p className="text-sm text-stone-600">
            Copy a recipe from a website, a note, or a text message and paste it below. Include the title, the ingredient list, and the steps —
            we'll fill in the form for you to check.
          </p>
          <textarea
            className="input min-h-[50dvh] font-mono text-sm"
            placeholder={'Grandma\'s Chicken Soup\nServes 6\n\nIngredients\n2 lb chicken thighs\n3 carrots, sliced\n…\n\nInstructions\n1. Simmer the chicken…'}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            {navigator.clipboard?.readText && (
              <button
                className="btn btn-secondary flex-1"
                onClick={async () => {
                  try {
                    setPasteText(await navigator.clipboard.readText());
                  } catch {
                    toast('Tap and hold in the box, then choose Paste');
                  }
                }}
              >
                <ClipboardPaste size={18} /> Paste
              </button>
            )}
            <button className="btn btn-primary flex-[2]" disabled={!pasteText.trim()} onClick={doParse}>
              <Wand2 size={18} /> Fill in recipe
            </button>
          </div>
          <button className="btn btn-ghost w-full" onClick={() => setStage('form')}>Skip — type it in instead</button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={title}
        back
        right={<button className="btn btn-primary px-4 py-2" disabled={busy} onClick={save}>Save</button>}
      />
      <div className="space-y-5 px-4 pb-10">
        {tried && problems.length > 0 && (
          <div className="card border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {problems.map((p) => <div key={p}>• {p}</div>)}
          </div>
        )}
        {importMode && (
          <p className="rounded-xl bg-brand-soft p-3 text-sm text-green-900">
            Here's what we found. Check the ingredients — anything we couldn't match is highlighted.
          </p>
        )}

        <section className="space-y-3">
          <div>
            <label className="label" htmlFor="r-title">Recipe name</label>
            <input id="r-title" className="input text-lg font-semibold" value={form.title} placeholder="e.g. Mom's Lasagna" onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="r-desc">Short description <span className="text-stone-400">(optional)</span></label>
            <textarea id="r-desc" className="input" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label" htmlFor="r-serv">Serves</label>
              <input id="r-serv" className="input" inputMode="numeric" value={form.servings} onChange={(e) => set('servings', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="r-prep">Prep min</label>
              <input id="r-prep" className="input" inputMode="numeric" value={form.prepMin} onChange={(e) => set('prepMin', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="r-cook">Cook min</label>
              <input id="r-cook" className="input" inputMode="numeric" value={form.cookMin} onChange={(e) => set('cookMin', e.target.value)} />
            </div>
          </div>
          <div>
            <span className="label">Good for</span>
            <div className="flex flex-wrap gap-2">
              {SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip capitalize ${form.slots.includes(s) ? 'chip-on' : ''}`}
                  onClick={() => set('slots', form.slots.includes(s) ? form.slots.filter((x) => x !== s) : [...form.slots, s])}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Ingredients</h2>
            <button className="btn btn-ghost px-2 py-1 text-sm" onClick={() => setBulkOpen(!bulkOpen)}>
              <ClipboardPaste size={16} /> Paste a list
            </button>
          </div>
          {bulkOpen && (
            <div className="card mt-2 space-y-2 p-3">
              <p className="text-sm text-stone-500">One ingredient per line, like “2 cups flour” or “1 onion, diced”.</p>
              <textarea className="input font-mono text-sm" rows={6} value={bulkText} onChange={(e) => setBulkText(e.target.value)} autoFocus />
              <button className="btn btn-primary w-full" disabled={!bulkText.trim()} onClick={addBulk}>Add ingredients</button>
            </div>
          )}
          <ul className="mt-2 space-y-2">
            {form.rows.map((row, idx) => (
              <IngredientRow
                key={row.key}
                row={row}
                showErrors={tried}
                problem={rowProblem(row)}
                onChange={(p) => setRow(row.key, p)}
                onPick={() => setPickerFor(row.key)}
                onRemove={() => set('rows', form.rows.filter((r) => r.key !== row.key))}
                onMove={(dir) => {
                  const j = idx + dir;
                  if (j < 0 || j >= form.rows.length) return;
                  const rows = [...form.rows];
                  [rows[idx], rows[j]] = [rows[j], rows[idx]];
                  set('rows', rows);
                }}
              />
            ))}
          </ul>
          <button className="btn btn-secondary mt-2 w-full" onClick={() => set('rows', [...form.rows, blankRow()])}>
            <Plus size={18} /> Add ingredient
          </button>
        </section>

        <section>
          <h2 className="text-lg font-bold">Steps</h2>
          <p className="text-xs text-stone-500">Tip: mention times like “simmer 20 minutes” and cook mode will offer a timer.</p>
          <ol className="mt-2 space-y-2">
            {form.steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
                <textarea
                  className="input"
                  rows={2}
                  value={s}
                  aria-label={`Step ${i + 1}`}
                  placeholder={i === 0 ? 'e.g. Preheat the oven to 400°F.' : ''}
                  onChange={(e) => set('steps', form.steps.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <button className="icon-btn mt-1 shrink-0 text-stone-400" aria-label={`Remove step ${i + 1}`} onClick={() => set('steps', form.steps.filter((_, j) => j !== i))}>
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ol>
          <button className="btn btn-secondary mt-2 w-full" onClick={() => set('steps', [...form.steps, ''])}>
            <Plus size={18} /> Add step
          </button>
        </section>

        <details className="card p-3">
          <summary className="cursor-pointer font-semibold">More details <span className="text-sm font-normal text-stone-400">(optional)</span></summary>
          <div className="mt-3 space-y-3">
            <div>
              <span className="label">Difficulty</span>
              <Segmented value={form.difficulty} options={[{ value: '1', label: 'Easy' }, { value: '2', label: 'Medium' }, { value: '3', label: 'Hard' }]} onChange={(v) => set('difficulty', v)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="r-cuisine">Cuisine</label>
                <input id="r-cuisine" className="input" list="cuisines" value={form.cuisine} onChange={(e) => set('cuisine', e.target.value)} />
                <datalist id="cuisines">{CUISINES.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label className="label" htmlFor="r-protein">Main protein</label>
                <select id="r-protein" className="input capitalize" value={form.protein} onChange={(e) => set('protein', e.target.value)}>
                  {PROTEINS.map((p) => <option key={p} value={p}>{p || '—'}</option>)}
                </select>
              </div>
            </div>
            <div>
              <span className="label">Diet</span>
              <div className="flex flex-wrap gap-2">
                {DIETS.map((d) => (
                  <button key={d} type="button" className={`chip capitalize ${form.diet.includes(d) ? 'chip-on' : ''}`}
                    onClick={() => set('diet', form.diet.includes(d) ? form.diet.filter((x) => x !== d) : [...form.diet, d])}>
                    {d.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="r-notes">Notes</label>
              <textarea id="r-notes" className="input" rows={3} value={form.notes} placeholder="Tips, substitutions, where it came from…" onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>
        </details>

        <button className="btn btn-primary w-full py-3.5" disabled={busy} onClick={save}>
          {existing ? 'Save changes' : 'Save recipe'}
        </button>
      </div>

      <IngredientPicker
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        initialQuery={form.rows.find((r) => r.key === pickerFor)?.name ?? ''}
        onPick={(ingId) => {
          const ing = ingredients.find((i) => i.id === ingId);
          const row = form.rows.find((r) => r.key === pickerFor);
          if (pickerFor === null || !row) return;
          // keep the typed unit when it works for the chosen ingredient
          const unit = ing && !canConvert(row.unit, ing) && !row.name ? unitsFor(ing)[0] ?? row.unit : row.unit;
          setRow(pickerFor, { ingredientId: ingId, unit });
        }}
      />
    </>
  );
}

function IngredientRow(props: {
  row: Row;
  problem?: string;
  showErrors: boolean;
  onChange: (p: Partial<Row>) => void;
  onPick: () => void;
  onRemove: () => void;
  onMove: (dir: number) => void;
}) {
  const { ingById } = useAppData();
  const { row } = props;
  const ing = row.ingredientId ? ingById.get(row.ingredientId) : undefined;
  const [aliasAmt, setAliasAmt] = useState('');
  const units = ing ? unitsFor(ing) : COMMON_UNITS;
  const unitOptions = units.includes(row.unit) ? units : [row.unit, ...units];
  const unconvertible = ing && !canConvert(row.unit, ing);
  const blank = !row.ingredientId && !row.name.trim() && !row.qty.trim();
  const highlight = !blank && (!row.ingredientId || unconvertible) && (props.showErrors || !!row.name);

  return (
    <li className={`card p-2.5 ${highlight ? 'border-amber-300 bg-amber-50/50' : ''}`}>
      <div className="flex items-center gap-2">
        <button className="-ml-1 text-stone-300" aria-label="Move up" onClick={() => props.onMove(-1)}>
          <GripVertical size={18} />
        </button>
        <button
          className={`input min-w-0 flex-1 truncate px-2 text-left font-medium ${ing ? '' : 'text-amber-800'}`}
          onClick={props.onPick}
        >
          {ing ? ing.name : row.name ? `“${row.name}” — tap to match` : <span className="font-normal text-stone-400">Choose ingredient</span>}
        </button>
        <label className="flex shrink-0 items-center gap-1 text-xs text-stone-600">
          <input type="checkbox" className="h-4 w-4 accent-green-700" checked={row.optional} onChange={(e) => props.onChange({ optional: e.target.checked })} />
          Optional
        </label>
        <button className="icon-btn h-9 w-9 shrink-0 text-stone-400" aria-label="Remove ingredient" onClick={props.onRemove}>
          <Trash2 size={17} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 pl-6">
        <input
          className="input w-16 shrink-0 px-2 py-1.5 text-center"
          inputMode="decimal"
          placeholder="Qty"
          aria-label="Amount"
          value={row.qty}
          onChange={(e) => props.onChange({ qty: e.target.value })}
        />
        <select className="input w-24 shrink-0 px-2 py-1.5" aria-label="Unit" value={row.unit} onChange={(e) => props.onChange({ unit: e.target.value })}>
          {unitOptions.map((u) => <option key={u} value={u}>{unitName(u)}</option>)}
        </select>
        <input
          className="input min-w-0 flex-1 px-2 py-1.5 text-sm"
          placeholder="Prep (diced, minced…)"
          aria-label="Preparation"
          value={row.prep}
          onChange={(e) => props.onChange({ prep: e.target.value })}
        />
      </div>
      {unconvertible && ing && (
        <div className="mt-2 rounded-lg bg-amber-100 p-2 text-sm text-amber-900">
          <div className="flex items-center gap-1 font-medium"><AlertTriangle size={14} /> How much is 1 {unitName(row.unit)} of {ing.name.toLowerCase()}?</div>
          <div className="mt-1.5 flex items-center gap-2">
            <input className="input w-24 px-2 py-1.5" inputMode="decimal" value={aliasAmt} onChange={(e) => setAliasAmt(e.target.value)} aria-label="Conversion amount" />
            <span>{ing.baseUnit === 'ea' ? `${ing.name.toLowerCase()} (count)` : ing.baseUnit === 'g' ? 'grams' : 'ml'}</span>
            <button
              className="btn btn-primary ml-auto px-3 py-1.5 text-sm"
              disabled={!parseQuantity(aliasAmt.trim())}
              onClick={() => {
                const n = parseQuantity(aliasAmt.trim())?.qty;
                if (!n) return;
                void updateIngredient(ing.id, { unitAliases: { ...ing.unitAliases, [normalizeUnit(row.unit)]: n } });
              }}
            >
              Save
            </button>
          </div>
          <div className="mt-1 text-xs">Or pick a different unit.</div>
        </div>
      )}
      {props.showErrors && props.problem && props.problem !== 'unit' && !blank && (
        <div className="mt-1 pl-6 text-xs text-amber-800">{props.problem}</div>
      )}
    </li>
  );
}
