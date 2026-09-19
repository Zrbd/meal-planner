// Recipe collections — your own shelves. One list of all of them, or one collection's recipes.
import { FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { COLLECTION_EMOJI } from '../../domain/collections';
import { createCollection, deleteCollection, renameCollection } from '../../services/collections';
import { EmptyState, PageHeader, RecipeCard, Sheet } from '../components';
import { useAppData } from '../data';
import { useCoverage } from '../hooks';
import { useToast } from '../toast';

/** Create / rename sheet. Passing an existing id turns it into a rename. */
function EditSheet(props: { open: boolean; onClose: () => void; id?: string; name?: string; emoji?: string }) {
  const [name, setName] = useState(props.name ?? '');
  const [emoji, setEmoji] = useState(props.emoji ?? COLLECTION_EMOJI[0]);
  const toast = useToast();
  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (props.id) await renameCollection(props.id, trimmed, emoji);
    else await createCollection(trimmed, emoji);
    toast(props.id ? 'Renamed' : `Created ${trimmed}`);
    props.onClose();
  };
  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title={props.id ? 'Rename collection' : 'New collection'}
      footer={<button className="btn btn-primary w-full" disabled={!name.trim()} onClick={() => void save()}>Save</button>}
    >
      <label className="label" htmlFor="coll-name">Name</label>
      <input id="coll-name" className="input" value={name} autoFocus placeholder="Weeknight winners" onChange={(e) => setName(e.target.value)} />
      <div className="label pt-3">Icon</div>
      <div className="flex flex-wrap gap-2">
        {COLLECTION_EMOJI.map((e) => (
          <button key={e} className={`chip text-lg ${e === emoji ? 'chip-on' : ''}`} onClick={() => setEmoji(e)}>{e}</button>
        ))}
      </div>
    </Sheet>
  );
}

export function Collections() {
  const d = useAppData();
  const coverage = useCoverage();
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const one = id ? d.collections.find((c) => c.id === id) : undefined;

  if (id && !one) {
    return (
      <>
        <PageHeader title="Collection" back="/collections" />
        <EmptyState emoji="🫙" title="That collection is gone" body="It may have been deleted on this device." />
      </>
    );
  }

  if (one) {
    const recipes = one.recipeIds.map((rid) => d.recipeById.get(rid)).filter((r) => !!r);
    const remove = async () => {
      if (!confirm(`Delete "${one.name}"? The recipes themselves stay put.`)) return;
      await deleteCollection(one.id);
      toast('Collection deleted');
      nav('/collections', { replace: true });
    };
    return (
      <>
        <PageHeader
          title={`${one.emoji ?? '📚'} ${one.name}`}
          subtitle={`${recipes.length} recipe${recipes.length === 1 ? '' : 's'}`}
          back="/collections"
          right={
            <div className="flex gap-1">
              <button className="icon-btn" aria-label="Rename" onClick={() => setRenaming(true)}><Pencil size={19} /></button>
              <button className="icon-btn text-red-600" aria-label="Delete" onClick={() => void remove()}><Trash2 size={19} /></button>
            </div>
          }
        />
        <div className="space-y-2 px-4 pb-8">
          {recipes.length === 0 ? (
            <EmptyState
              emoji="📚"
              title="Nothing in here yet"
              body="Open any recipe, tap the bookmark, and pick this collection."
              action={<Link to="/recipes" className="btn btn-primary">Browse recipes</Link>}
            />
          ) : (
            recipes.map((r) => <RecipeCard key={r.id} recipe={r} coverage={coverage.get(r.id)} />)
          )}
        </div>
        {renaming && <EditSheet open onClose={() => setRenaming(false)} id={one.id} name={one.name} emoji={one.emoji} />}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Collections"
        subtitle="Your own shelves"
        back
        right={<button className="icon-btn" aria-label="New collection" onClick={() => setNewOpen(true)}><FolderPlus size={20} /></button>}
      />
      <div className="space-y-2 px-4 pb-8">
        {d.collections.length === 0 ? (
          <EmptyState
            emoji="📚"
            title="No collections yet"
            body="Group recipes however you like — 'Weeknight winners', 'Cooking for a crowd', 'Things the kids eat'."
            action={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><FolderPlus size={18} /> New collection</button>}
          />
        ) : (
          <ul className="card divide-y divide-stone-100">
            {d.collections.map((c) => (
              <li key={c.id}>
                <Link to={`/collections/${c.id}`} className="flex items-center gap-3 p-3">
                  <span className="text-2xl">{c.emoji ?? '📚'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="text-xs text-stone-500">{c.recipeIds.length} recipe{c.recipeIds.length === 1 ? '' : 's'}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {newOpen && <EditSheet open onClose={() => setNewOpen(false)} />}
    </>
  );
}
