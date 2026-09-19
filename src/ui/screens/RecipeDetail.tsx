import { CalendarPlus, Check, ChefHat, Clock, Copy, EyeOff, Heart, Minus, MoreHorizontal, Pencil, Plus, Star, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { recipeCoverage } from '../../domain/coverage';
import { addDaysISO, relativeDayLabel, toISODate } from '../../domain/dates';
import { SLOTS, type Ingredient, type Recipe, type Slot } from '../../domain/types';
import { tipIngredients, tipsByStep } from '../../domain/freshness';
import { ExternalLink, Lightbulb, RotateCcw } from 'lucide-react';
import { FlipAmount, StorageTip, useRecipeUnits } from '../amounts';
import { addMeal, removeMeal } from '../../services/plan';
import { deleteRecipe, duplicateRecipe, setArchived, setRating, toggleFavorite } from '../../services/recipes';
import { EmptyState, PageHeader, RecipeThumb, Segmented, Sheet, totalTime } from '../components';
import { useAppData } from '../data';
import { useAvailability, usePrices } from '../hooks';
import { money, recipeCost } from '../../domain/prices';
import { scaleChoices } from '../../domain/scaleto';
import { renderStep } from '../../domain/steptext';
import { swapSuggestions } from '../../domain/substitute';
import { formatAmount, formatNumber } from '../../domain/units';
import { substituteIngredient } from '../../services/recipes';
import { IngredientPicker } from '../components';
import { ArrowLeftRight, Scale } from 'lucide-react';
import { useToast } from '../toast';
import { BookMarked, NotebookPen, Share2 } from 'lucide-react';
import { collectionsOf } from '../../domain/collections';
import { entriesFor } from '../../domain/journal';
import { recipeToText } from '../../domain/recipetext';
import { createCollection, toggleInCollection } from '../../services/collections';
import { addJournalEntry, deleteJournalEntry } from '../../services/journal';
import { shareText } from '../share';

export function RecipeDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const d = useAppData();
  const { recipeById, ingById, ingredients, settings, today } = d;
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [scaleIdx, setScaleIdx] = useState<number | null>(null);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [swapSearch, setSwapSearch] = useState(false);
  const { available, looseLevel } = useAvailability();
  const recipe = recipeById.get(id);
  const [servings, setServings] = useState(settings.householdSize);
  const [menuOpen, setMenuOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [collOpen, setCollOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const units = useRecipeUnits(id, settings.units);
  const prices = usePrices();

  const coverage = useMemo(
    () => recipe && recipeCoverage(recipe, servings, available, looseLevel, ingById),
    [recipe, servings, available, looseLevel, ingById],
  );

  if (!recipe) {
    return (
      <>
        <PageHeader title="Recipe" back="/recipes" />
        <EmptyState emoji="🤷" title="Recipe not found" />
      </>
    );
  }
  const scale = servings / (recipe.baseServings || 1);
  const missing = new Set(coverage?.missing ?? []);
  const tips = tipIngredients(recipe, ingById);
  const stepTips = tipsByStep(recipe, ingById);
  const cost = recipeCost(recipe, servings, ingById, prices);
  const inCollections = collectionsOf(d.collections, recipe.id);
  const journal = entriesFor(d.journal, recipe.id);

  return (
    <>
      <PageHeader
        title=""
        back
        right={
          <>
            <button className="icon-btn" aria-label={recipe.favorite ? 'Unfavorite' : 'Favorite'} onClick={() => void toggleFavorite(recipe.id)}>
              <Heart size={22} className={recipe.favorite ? 'fill-red-500 text-red-500' : ''} />
            </button>
            <button className="icon-btn" aria-label="Add to a collection" onClick={() => setCollOpen(true)}>
              <BookMarked size={21} className={inCollections.length ? 'fill-brand-soft text-brand' : ''} />
            </button>
            <button className="icon-btn" aria-label="More" onClick={() => setMenuOpen(true)}>
              <MoreHorizontal size={22} />
            </button>
          </>
        }
      />
      <article className="px-4 pb-28">
        <div className="flex items-start gap-4">
          <RecipeThumb recipe={recipe} className="h-24 w-24 text-5xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl leading-tight font-bold">{recipe.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
              <span className="inline-flex items-center gap-1"><Clock size={14} /> {totalTime(recipe)} min</span>
              <span>{recipe.cuisine}</span>
              <span>{'●'.repeat(recipe.difficulty)}{'○'.repeat(3 - recipe.difficulty)}</span>
              {recipe.role === 'side' && <span className="rounded-full bg-stone-100 px-2 text-xs font-semibold text-stone-600">Side dish</span>}
              {recipe.tags?.includes('smoker') && <span className="rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-800">🔥 Smoker</span>}
            </div>
            <div className="mt-2 flex gap-0.5" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} aria-label={`${n} stars`} onClick={() => void setRating(recipe.id, recipe.rating === n ? undefined : n)}>
                  <Star size={20} className={(recipe.rating ?? 0) >= n ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />
                </button>
              ))}
            </div>
          </div>
        </div>
        {recipe.description && <p className="mt-3 text-stone-600">{recipe.description}</p>}
        {recipe.credit && (
          <a href={recipe.credit.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-brand">
            Adapted from {recipe.credit.author ? `${recipe.credit.author}, ` : ''}{recipe.credit.name} <ExternalLink size={13} />
          </a>
        )}
        {(recipe.diet.length > 0 || recipe.source === 'user') && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recipe.source === 'user' && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">My recipe</span>}
            {recipe.diet.map((t) => (
              <span key={t} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 capitalize">{t.replace('-', ' ')}</span>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">Ingredients</h2>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-stone-400" />
            <button className="icon-btn h-8 w-8 bg-stone-100" aria-label="Fewer servings" onClick={() => setServings(Math.max(1, servings - 1))}>
              <Minus size={16} />
            </button>
            <span className="w-8 text-center font-semibold" aria-live="polite">{formatNumber(servings)}</span>
            <button className="icon-btn h-8 w-8 bg-stone-100" aria-label="More servings" onClick={() => setServings(servings + 1)}>
              <Plus size={16} />
            </button>
          </div>
        </div>
        <button className="btn btn-ghost mt-2 px-2 py-1 text-xs" onClick={() => { setScaleIdx(null); setScaleOpen(true); }}>
          <Scale size={13} /> Scale to one ingredient
        </button>
        {coverage && (
          <p className="mt-1 text-sm text-stone-500">
            {coverage.canMake ? '✅ You have everything you need.' : `You're missing ${coverage.missing.length} ingredient${coverage.missing.length === 1 ? '' : 's'}.`}
          </p>
        )}
        {cost.priced > 0 && (
          <p className="mt-0.5 text-sm text-stone-500">
            💵 About {money(cost.total)} · {money(cost.total / servings)} a serving
            {cost.unpriced > 0 && <span className="text-stone-400"> ({cost.unpriced} ingredient{cost.unpriced === 1 ? '' : 's'} not priced yet)</span>}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <div className="w-40">
            <Segmented value={units.system} options={[{ value: 'us', label: 'US' }, { value: 'metric', label: 'Metric' }]} onChange={units.setSystem} />
          </div>
          {units.hasFlips ? (
            <button className="btn btn-ghost px-2 py-1 text-xs" onClick={units.resetFlips}><RotateCcw size={13} /> Reset switched units</button>
          ) : (
            <span className="text-xs text-stone-400">Tap an amount to switch just that one</span>
          )}
        </div>
        <ul className="card mt-3 divide-y divide-stone-100">
          {recipe.ingredients.map((ri, idx) => {
            const ing = ingById.get(ri.ingredientId);
            const showGroup = ri.group && ri.group !== recipe.ingredients[idx - 1]?.group;
            const have = ing && !missing.has(ing.id);
            return (
              <li key={idx}>
                {showGroup && <div className="bg-stone-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">{ri.group}</div>}
                <div className="flex items-start gap-3 px-3 py-2.5">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${have ? 'bg-green-100 text-green-700' : 'bg-stone-100'}`}>
                    {have && <Check size={13} strokeWidth={3} />}
                  </span>
                  <div className="flex-1">
                    <FlipAmount amount={units.line(ri, idx, scale, ing)} />{' '}
                    <button className="text-left underline decoration-stone-300 decoration-dotted underline-offset-4" onClick={() => setSwapIdx(idx)}>
                      {ing?.name.toLowerCase() ?? ri.ingredientId}
                    </button>
                    {ri.prep && <span className="text-stone-500">, {ri.prep}</span>}
                    {ri.optional && <span className="text-stone-400"> (optional)</span>}
                    {ri.swappedFrom && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-sky-700">
                        <ArrowLeftRight size={12} /> Swapped in for {ingById.get(ri.swappedFrom.ingredientId)?.name.toLowerCase() ?? 'the original'}
                        <button
                          className="ml-1 font-semibold underline"
                          onClick={() => void substituteIngredient(recipe.id, idx, ri.swappedFrom!.ingredientId).then(() => toast('Back to the original'))}
                        >
                          Undo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-6 text-lg font-bold">Steps</h2>
        <ol className="mt-2 space-y-3">
          {recipe.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="pt-0.5 leading-relaxed">{renderStep(s, { scale, system: units.system, recipe, ingById })}</p>
                {stepTips.get(i)?.map((ing) => <StorageTip key={ing.id} ing={ing} compact />)}
              </div>
            </li>
          ))}
        </ol>
        {tips.length > 0 && (
          <>
            <h2 className="mt-6 flex items-center gap-1.5 text-lg font-bold"><Lightbulb size={18} className="text-emerald-600" /> Keep it fresh</h2>
            <p className="mt-1 text-sm text-stone-500">How to make the leftover ingredients from this recipe last longer.</p>
            <div className="mt-2 space-y-2">
              {tips.map((ing) => <StorageTip key={ing.id} ing={ing} />)}
            </div>
          </>
        )}
        {recipe.notes && (
          <div className="card mt-5 bg-amber-50 p-3 text-sm">
            <b>Notes:</b> {recipe.notes}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-lg font-bold"><NotebookPen size={18} className="text-stone-400" /> Your notes</h2>
          <button className="text-sm font-semibold text-brand" onClick={() => setJournalOpen(true)}>Add a note</button>
        </div>
        {journal.length === 0 ? (
          <p className="mt-1 text-sm text-stone-500">
            Next time you make this, jot down what you'd change — less salt, longer in the oven, doubled it fine.
          </p>
        ) : (
          <ul className="card mt-2 divide-y divide-stone-100">
            {journal.map((e) => (
              <li key={e.id} className="p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-stone-500">
                    {relativeDayLabel(toISODate(new Date(e.at)), today)}
                    {e.rating ? ` · ${'★'.repeat(e.rating)}` : ''}
                    {e.servings ? ` · ${formatNumber(e.servings)} servings` : ''}
                  </span>
                  <button className="text-xs text-stone-400" onClick={() => void deleteJournalEntry(e.id)}>Delete</button>
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{e.note}</p>
              </li>
            ))}
          </ul>
        )}
      </article>

      <div className="fixed inset-x-0 z-20 bottom-safe-tab">
        <div className="mx-auto flex max-w-xl gap-2 px-4">
          <button className="btn btn-secondary flex-1 bg-white shadow-md" onClick={() => setPlanOpen(true)}>
            <CalendarPlus size={18} /> Add to plan
          </button>
          <button className="btn btn-primary flex-1 shadow-md" onClick={() => navigate(`/recipes/${recipe.id}/cook?servings=${servings}`)}>
            <ChefHat size={18} /> Cook now
          </button>
        </div>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={recipe.title}>
        <div className="space-y-1">
          <button className="btn btn-secondary w-full justify-start" onClick={() => navigate(`/recipes/${recipe.id}/edit`)}>
            <Pencil size={18} /> Edit recipe
          </button>
          <button
            className="btn btn-secondary w-full justify-start"
            onClick={async () => {
              const text = recipeToText(recipe, { servings, system: units.system, ingById });
              const res = await shareText(recipe.title, text);
              setMenuOpen(false);
              toast(res === 'copied' ? 'Recipe copied to the clipboard' : res === 'failed' ? "Couldn't share that" : 'Shared');
            }}
          >
            <Share2 size={18} /> Share as text
          </button>
          <button
            className="btn btn-secondary w-full justify-start"
            onClick={async () => {
              const copy = await duplicateRecipe(recipe.id);
              setMenuOpen(false);
              if (copy) navigate(`/recipes/${copy}/edit`);
            }}
          >
            <Copy size={18} /> Make a copy
          </button>
          {recipe.source === 'builtin' ? (
            <button
              className="btn btn-secondary w-full justify-start"
              onClick={async () => {
                await setArchived(recipe.id, !recipe.archived);
                setMenuOpen(false);
                toast(recipe.archived ? 'Recipe restored' : 'Recipe hidden from lists and auto-plan');
              }}
            >
              <EyeOff size={18} /> {recipe.archived ? 'Unhide recipe' : 'Hide recipe'}
            </button>
          ) : (
            <button
              className="btn btn-danger w-full justify-start"
              onClick={async () => {
                if (!window.confirm(`Delete “${recipe.title}”? This can't be undone.`)) return;
                await deleteRecipe(recipe.id);
                navigate('/recipes', { replace: true });
                toast('Recipe deleted');
              }}
            >
              <Trash2 size={18} /> Delete recipe
            </button>
          )}
        </div>
      </Sheet>

      {swapIdx !== null && recipe.ingredients[swapIdx] && (() => {
        const ri = recipe.ingredients[swapIdx];
        const cur = ingById.get(ri.ingredientId);
        const original = ri.swappedFrom ? ingById.get(ri.swappedFrom.ingredientId) : undefined;
        const doSwap = async (newId: string) => {
          const name = ingById.get(newId)?.name.toLowerCase() ?? 'it';
          await substituteIngredient(recipe.id, swapIdx, newId);
          setSwapIdx(null);
          setSwapSearch(false);
          toast(original?.id === newId ? 'Back to the original' : `Using ${name} — your plan and shopping list will follow`);
        };
        return (
          <>
            <Sheet open={!swapSearch} onClose={() => setSwapIdx(null)} title={`Swap ${cur?.name.toLowerCase() ?? 'ingredient'}`}>
              <p className="mb-3 text-sm text-stone-500">
                Pick what you'll actually use. The recipe, steps, shopping list and pantry all update — no need to remember at cook time.
              </p>
              {original && (
                <button className="btn btn-secondary mb-3 w-full justify-start" onClick={() => void doSwap(original.id)}>
                  <RotateCcw size={16} /> Back to {original.name.toLowerCase()}
                </button>
              )}
              {cur && (
                <div className="flex flex-wrap gap-2">
                  {swapSuggestions(original ?? cur, ingredients)
                    .filter((x) => x.id !== cur.id)
                    .map((x) => (
                      <button key={x.id} className="chip" onClick={() => void doSwap(x.id)}>{x.name}</button>
                    ))}
                </div>
              )}
              <button className="btn btn-primary mt-4 w-full" onClick={() => setSwapSearch(true)}>Search all ingredients</button>
            </Sheet>
            <ScaleSheet
              open={scaleOpen}
              onClose={() => setScaleOpen(false)}
              recipe={recipe}
              ingById={ingById}
              idx={scaleIdx}
              onPickLine={setScaleIdx}
              onScale={(servingsAt) => { setServings(servingsAt); setScaleOpen(false); }}
            />
            <IngredientPicker
              open={swapSearch}
              onClose={() => setSwapSearch(false)}
              title="Swap for…"
              onPick={(newId) => void doSwap(newId)}
            />
          </>
        );
      })()}

      <CollectionsSheet
        open={collOpen}
        onClose={() => setCollOpen(false)}
        recipeId={recipe.id}
        onToast={toast}
      />

      <JournalSheet
        open={journalOpen}
        onClose={() => setJournalOpen(false)}
        recipeId={recipe.id}
        servings={servings}
        currentRating={recipe.rating}
        onToast={toast}
      />

      <AddToPlanSheet
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        slots={recipe.slots}
        today={today}
        onAdd={async (date, slot) => {
          const mealId = await addMeal(recipe.id, date, slot, servings);
          setPlanOpen(false);
          toast(`Added to ${relativeDayLabel(date, today)}`, { label: 'Undo', run: () => removeMeal(mealId) });
        }}
      />
    </>
  );
}

function AddToPlanSheet(props: {
  open: boolean;
  onClose: () => void;
  slots: Slot[];
  today: string;
  onAdd: (date: string, slot: Slot) => void;
}) {
  const [slot, setSlot] = useState<Slot>(props.slots.includes('dinner') ? 'dinner' : props.slots[0] ?? 'dinner');
  const days = Array.from({ length: 14 }, (_, i) => addDaysISO(props.today, i));
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Add to plan">
      <Segmented
        value={slot}
        options={SLOTS.map((s) => ({ value: s, label: <span className="capitalize">{s}</span> }))}
        onChange={setSlot}
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {days.map((d) => (
          <button key={d} className="btn btn-secondary justify-start" onClick={() => props.onAdd(d, slot)}>
            {relativeDayLabel(d, props.today)}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** "I want to use one can of beans": pick a line, pick an amount, and the recipe scales to it. */
function ScaleSheet(props: {
  open: boolean;
  onClose: () => void;
  recipe: Recipe;
  ingById: Map<string, Ingredient>;
  idx: number | null;
  onPickLine: (idx: number) => void;
  onScale: (servings: number) => void;
}) {
  const { recipe, ingById, idx } = props;
  const lines = recipe.ingredients
    .map((ri, i) => ({ ri, i, ing: ingById.get(ri.ingredientId) }))
    .filter((l) => l.ing && l.ri.qty > 0);
  const chosen = idx === null ? undefined : lines.find((l) => l.i === idx);
  const choices = chosen ? scaleChoices(recipe, chosen.ri, chosen.ing!) : [];
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Scale to one ingredient">
      {!chosen ? (
        <>
          <p className="pb-2 text-sm text-stone-500">Cook to what you have — pick the ingredient you want to use up.</p>
          <ul className="card divide-y divide-stone-100">
            {lines.map((l) => (
              <li key={l.i}>
                <button className="flex w-full items-center justify-between p-3 text-left" onClick={() => props.onPickLine(l.i)}>
                  <span>{l.ing!.name.toLowerCase()}</span>
                  <span className="text-sm text-stone-500">{formatAmount(l.ri.qty, l.ri.unit)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="pb-2 text-sm text-stone-500">
            How much {chosen.ing!.name.toLowerCase()} do you want to use? The recipe calls for {formatAmount(chosen.ri.qty, chosen.ri.unit)}.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {choices.map((c) => (
              <button key={`${c.qty}:${c.unit}`} className="btn btn-secondary flex-col items-start py-2" onClick={() => props.onScale(c.servings)}>
                <span className="font-semibold">{c.label}</span>
                <span className="text-xs text-stone-500">makes {formatNumber(c.servings)} serving{c.servings === 1 ? '' : 's'}</span>
              </button>
            ))}
          </div>
          {choices.length === 0 && <p className="text-sm text-stone-500">This one can't be scaled on its own.</p>}
          <button className="btn btn-ghost mt-3 w-full" onClick={() => props.onPickLine(-1)}>Pick a different ingredient</button>
        </>
      )}
    </Sheet>
  );
}

/** Tick the shelves this recipe belongs on. Creating a new one from here saves a trip. */
function CollectionsSheet(props: { open: boolean; onClose: () => void; recipeId: string; onToast: (t: string) => void }) {
  const { collections } = useAppData();
  const [name, setName] = useState('');
  const mine = new Set(collectionsOf(collections, props.recipeId).map((c) => c.id));
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Add to a collection">
      {collections.length === 0 && (
        <p className="pb-3 text-sm text-stone-500">
          Collections are your own shelves — "Weeknight winners", "Cooking for a crowd". Make the first one below.
        </p>
      )}
      <div className="space-y-1">
        {collections.map((c) => (
          <button
            key={c.id}
            className={`btn w-full justify-start ${mine.has(c.id) ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => void toggleInCollection(c.id, props.recipeId)}
          >
            <span className="text-lg">{c.emoji ?? '📚'}</span>
            <span className="flex-1 text-left">{c.name}</span>
            {mine.has(c.id) && <Check size={18} />}
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input className="input flex-1" placeholder="New collection…" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn btn-primary"
          disabled={!name.trim()}
          onClick={async () => {
            const id = await createCollection(name.trim(), undefined, [props.recipeId]);
            setName('');
            props.onToast(`Saved to ${name.trim()}`);
            return id;
          }}
        >
          Create
        </button>
      </div>
    </Sheet>
  );
}

/** A dated note about the time you actually cooked it, optionally re-rating the recipe. */
function JournalSheet(props: {
  open: boolean;
  onClose: () => void;
  recipeId: string;
  servings: number;
  currentRating?: number;
  onToast: (t: string) => void;
}) {
  const [note, setNote] = useState('');
  const [rating, setRating] = useState<number | undefined>(props.currentRating);
  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title="How did it go?"
      footer={
        <button
          className="btn btn-primary w-full"
          disabled={!note.trim()}
          onClick={async () => {
            await addJournalEntry({ recipeId: props.recipeId, note: note.trim(), rating, servings: props.servings });
            setNote('');
            props.onToast('Note saved');
            props.onClose();
          }}
        >
          Save note
        </button>
      }
    >
      <p className="pb-2 text-sm text-stone-500">
        Anything you'd do differently. These show on the recipe, and appear in Cook mode before you start.
      </p>
      <textarea
        className="input h-28"
        autoFocus
        placeholder="Halved the chilli, still plenty hot. Needed 10 more minutes."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="label pt-3">Rating</div>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} aria-label={`${n} stars`} onClick={() => setRating(rating === n ? undefined : n)}>
            <Star size={26} className={(rating ?? 0) >= n ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
