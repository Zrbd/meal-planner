import { CalendarPlus, Check, ChefHat, Clock, Copy, EyeOff, Heart, Minus, MoreHorizontal, Pencil, Plus, Star, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { recipeCoverage } from '../../domain/coverage';
import { addDaysISO, relativeDayLabel } from '../../domain/dates';
import { SLOTS, type Slot } from '../../domain/types';
import { tipIngredients, tipsByStep } from '../../domain/freshness';
import { ExternalLink, Lightbulb, RotateCcw } from 'lucide-react';
import { FlipAmount, StorageTip, useRecipeUnits } from '../amounts';
import { addMeal, removeMeal } from '../../services/plan';
import { deleteRecipe, duplicateRecipe, setArchived, setRating, toggleFavorite } from '../../services/recipes';
import { EmptyState, PageHeader, RecipeThumb, Segmented, Sheet, totalTime } from '../components';
import { useAppData } from '../data';
import { useAvailability } from '../hooks';
import { useToast } from '../toast';

export function RecipeDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { recipeById, ingById, settings, today } = useAppData();
  const { available, looseLevel } = useAvailability();
  const recipe = recipeById.get(id);
  const [servings, setServings] = useState(settings.householdSize);
  const [menuOpen, setMenuOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const units = useRecipeUnits(id, settings.units);

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
            <span className="w-6 text-center font-semibold" aria-live="polite">{servings}</span>
            <button className="icon-btn h-8 w-8 bg-stone-100" aria-label="More servings" onClick={() => setServings(servings + 1)}>
              <Plus size={16} />
            </button>
          </div>
        </div>
        {coverage && (
          <p className="mt-1 text-sm text-stone-500">
            {coverage.canMake ? '✅ You have everything you need.' : `You're missing ${coverage.missing.length} ingredient${coverage.missing.length === 1 ? '' : 's'}.`}
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
                    {ing?.name.toLowerCase() ?? ri.ingredientId}
                    {ri.prep && <span className="text-stone-500">, {ri.prep}</span>}
                    {ri.optional && <span className="text-stone-400"> (optional)</span>}
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
                <p className="pt-0.5 leading-relaxed">{s}</p>
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
