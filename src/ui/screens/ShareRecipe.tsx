// Feature 20: hand a recipe to someone else. One self-contained file carrying the recipe and
// the ingredient definitions it needs, so it lands in their catalog intact.
import { Copy, Download, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ShareError, exportRecipe, shareFilename, toJSON, type ImportResult } from '../../domain/share';
import { importShared, inspectShared } from '../../services/share';
import { PageHeader, Segmented } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';

/** Export one recipe: /recipes/:id/share */
export function ShareRecipe() {
  const { id } = useParams<{ id: string }>();
  const { recipeById, ingById } = useAppData();
  const toast = useToast();
  const recipe = id ? recipeById.get(id) : undefined;
  if (!recipe) return <Navigate to="/recipes" replace />;

  const json = toJSON(exportRecipe(recipe, ingById, Date.now()));
  const filename = shareFilename(recipe);
  const blob = () => new Blob([json], { type: 'application/json' });

  return (
    <>
      <PageHeader title="Share this recipe" subtitle={recipe.title} back={`/recipes/${id}`} />
      <div className="space-y-3 px-4 pb-8">
        <div className="card p-4">
          <p className="text-sm text-stone-600">
            The file carries the recipe and full details for every ingredient in it, so whoever opens it gets the amounts and
            units right even if their catalog has never heard of tamarind paste. Your notes, ratings and cook history stay here.
          </p>
        </div>

        {'share' in navigator && (
          <button
            className="btn btn-primary w-full"
            onClick={async () => {
              const file = new File([blob()], filename, { type: 'application/json' });
              try {
                await navigator.share({ files: [file], title: recipe.title });
              } catch {
                /* the user backed out of the share sheet */
              }
            }}
          >
            <Share2 size={18} /> Share…
          </button>
        )}

        <button
          className="btn btn-secondary w-full"
          onClick={() => {
            const url = URL.createObjectURL(blob());
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={18} /> Save the file
        </button>

        <button
          className="btn btn-secondary w-full"
          onClick={async () => {
            await navigator.clipboard.writeText(json);
            toast('Copied — paste it anywhere');
          }}
        >
          <Copy size={18} /> Copy as text
        </button>

        <div className="card p-4">
          <div className="label">What gets sent</div>
          <pre className="mt-1 max-h-40 overflow-auto rounded-xl bg-stone-50 p-3 text-[11px] leading-snug text-stone-500">{json.slice(0, 600)}…</pre>
        </div>
      </div>
    </>
  );
}

/** Import someone else's file: /recipes/receive */
export function ReceiveRecipe() {
  const navigate = useNavigate();
  const toast = useToast();
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'copy' | 'replace'>('copy');

  const inspect = async (value: string) => {
    setText(value);
    setResult(null);
    setError('');
    if (!value.trim()) return;
    try {
      setResult(await inspectShared(value));
    } catch (e) {
      setError(e instanceof ShareError ? e.message : 'That file could not be read.');
    }
  };

  return (
    <>
      <PageHeader title="Add a shared recipe" subtitle="From a file or pasted text" back="/recipes" />
      <div className="space-y-3 px-4 pb-8">
        <label className="btn btn-secondary w-full">
          Choose a file…
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await inspect(await file.text());
            }}
          />
        </label>

        <textarea
          className="input h-32 font-mono text-xs"
          placeholder="…or paste the recipe text here"
          value={text}
          onChange={(e) => void inspect(e.target.value)}
        />

        {error && <div className="card border border-red-200 p-4 text-sm text-red-700">{error}</div>}

        {result && (
          <div className="card space-y-3 p-4">
            <div>
              <div className="text-lg font-bold">{result.shared.recipe.title}</div>
              <div className="text-xs text-stone-500">
                {result.shared.recipe.ingredients.length} ingredients · {result.shared.recipe.steps.length} steps · serves{' '}
                {result.shared.recipe.baseServings}
              </div>
            </div>
            {result.newIngredients.length > 0 && (
              <p className="text-sm text-stone-600">
                {result.newIngredients.length} new item{result.newIngredients.length === 1 ? '' : 's'} will be added to your
                catalog: {result.newIngredients.map((i) => i.name).join(', ')}.
              </p>
            )}
            {result.collides && (
              <>
                <p className="text-sm text-amber-700">You already have a recipe with this id.</p>
                <Segmented
                  value={mode}
                  options={[
                    { value: 'copy', label: 'Keep both' },
                    { value: 'replace', label: 'Replace mine' },
                  ]}
                  onChange={setMode}
                />
              </>
            )}
            <button
              className="btn btn-primary w-full"
              onClick={async () => {
                const newId = await importShared(result, mode);
                toast('Recipe added');
                navigate(`/recipes/${newId}`);
              }}
            >
              Add to my recipes
            </button>
          </div>
        )}
      </div>
    </>
  );
}
