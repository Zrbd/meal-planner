// Feature 15: every edit to a recipe keeps a snapshot, so "I've ruined it, what did it used to
// say?" has an answer. Twelve deep, per recipe, kept on the device like everything else.
import { Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { clearHistory, revertTo } from '../../services/history';
import { EmptyState, PageHeader, Sheet } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';

const when = (at: number) => new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function RecipeHistory() {
  const { id } = useParams<{ id: string }>();
  const { recipeById, recipeHistory } = useAppData();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState<number | null>(null);

  const recipe = id ? recipeById.get(id) : undefined;
  if (!id) return <Navigate to="/recipes" replace />;
  const revisions = [...(recipeHistory[id] ?? [])].sort((a, b) => b.at - a.at);
  const target = revisions.find((r) => r.at === confirming);

  return (
    <>
      <PageHeader
        title="Edit history"
        subtitle={recipe?.title}
        back={`/recipes/${id}`}
        right={
          revisions.length > 0 ? (
            <button className="px-2 text-sm text-stone-500" onClick={() => void clearHistory(id)}>
              Clear
            </button>
          ) : undefined
        }
      />
      <div className="space-y-3 px-4 pb-8">
        {revisions.length === 0 ? (
          <EmptyState emoji="🕰️" title="No edits yet" body="Once you change this recipe, the version before each change is kept here." />
        ) : (
          <>
            <p className="px-1 text-xs text-stone-500">
              Each row is what the recipe looked like <em>before</em> that edit. Restoring one is itself an edit, so you can always
              come back.
            </p>
            <ul className="card divide-y divide-stone-100">
              {revisions.map((rev) => (
                <li key={rev.at} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{rev.summary}</div>
                    <div className="text-xs text-stone-500">
                      {when(rev.at)} · {rev.snapshot.ingredients.length} ingredients, {rev.snapshot.steps.length} steps
                    </div>
                  </div>
                  <button className="icon-btn" aria-label="Restore this version" onClick={() => setConfirming(rev.at)}>
                    <Undo2 size={20} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Sheet open={confirming !== null} onClose={() => setConfirming(null)} title="Restore this version?">
        {target && (
          <>
            <p className="text-sm text-stone-500">
              “{target.snapshot.title}” as it was on {when(target.at)}, with {target.snapshot.ingredients.length} ingredients and{' '}
              {target.snapshot.steps.length} steps. The current version is kept in the history, so this is undoable.
            </p>
            <button
              className="btn btn-primary mt-4 w-full"
              onClick={async () => {
                await revertTo(id, target.at);
                setConfirming(null);
                toast('Recipe restored');
                navigate(`/recipes/${id}`);
              }}
            >
              Restore it
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}
