// Feature 4: saved weeks. Most households rotate the same four or five weeks forever.
import { CalendarCheck, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { addDaysISO, formatDay, startOfWeekISO } from '../../domain/dates';
import type { PlanTemplate } from '../../domain/templates';
import { deleteTemplate, renameTemplate, saveTemplate, useTemplate } from '../../services/templates';
import { EmptyState, PageHeader, Sheet } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';

export function Templates() {
  const { templates, recipeById, settings, today } = useAppData();
  const toast = useToast();
  const thisWeek = startOfWeekISO(today, settings.weekStartsOn);

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [applying, setApplying] = useState<PlanTemplate | null>(null);
  const [target, setTarget] = useState(addDaysISO(thisWeek, 7));
  const [replace, setReplace] = useState(false);

  return (
    <>
      <PageHeader
        title="Saved weeks"
        subtitle={templates.length ? `${templates.length} saved` : undefined}
        back="/plan"
        right={
          <button className="px-2 text-sm font-medium text-brand" onClick={() => { setName(''); setSaving(true); }}>
            Save this week
          </button>
        }
      />
      <div className="space-y-3 px-4 pb-8">
        {templates.length === 0 ? (
          <EmptyState
            emoji="🗂️"
            title="No saved weeks yet"
            body="Plan a week you like, then save it. Dropping it onto a later week takes one tap instead of seven."
            action={<Link to="/plan" className="btn btn-primary">Go to the plan</Link>}
          />
        ) : (
          templates.map((t) => (
            <div key={t.id} className="card p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-stone-500">
                    {t.meals.length} meal{t.meals.length === 1 ? '' : 's'}
                    {t.usedAt ? ` · last used ${formatDay(new Date(t.usedAt).toISOString().slice(0, 10), 'MMM d')}` : ''}
                  </div>
                </div>
                <button
                  className="icon-btn"
                  aria-label="Rename"
                  onClick={() => {
                    const next = window.prompt('Name this week', t.name);
                    if (next) void renameTemplate(t.id, next);
                  }}
                >
                  <Pencil size={18} />
                </button>
                <button className="icon-btn text-red-600" aria-label="Delete" onClick={() => void deleteTemplate(t.id)}>
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.meals.slice(0, 8).map((m, i) => (
                  <span key={i} className="chip text-xs">
                    {recipeById.get(m.recipeId)?.title ?? 'Deleted recipe'}
                  </span>
                ))}
                {t.meals.length > 8 && <span className="chip text-xs">+{t.meals.length - 8}</span>}
              </div>
              <button
                className="btn btn-secondary mt-3 w-full"
                onClick={() => {
                  setApplying(t);
                  setTarget(addDaysISO(thisWeek, 7));
                  setReplace(false);
                }}
              >
                <CalendarCheck size={18} /> Use this week
              </button>
            </div>
          ))
        )}
      </div>

      <Sheet open={saving} onClose={() => setSaving(false)} title="Save this week">
        <p className="text-sm text-stone-500">
          Everything planned from {formatDay(thisWeek, 'MMM d')} to {formatDay(addDaysISO(thisWeek, 6), 'MMM d')} is saved as a
          reusable week.
        </p>
        <input className="input mt-3" placeholder="Name it, e.g. “Easy week”" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn btn-primary mt-3 w-full"
          onClick={async () => {
            const id = await saveTemplate(name, thisWeek, addDaysISO(thisWeek, 6));
            setSaving(false);
            toast(id ? 'Week saved' : 'Nothing planned this week to save');
          }}
        >
          Save
        </button>
      </Sheet>

      <Sheet open={!!applying} onClose={() => setApplying(null)} title={applying?.name ?? ''}>
        <label className="label">Start on</label>
        <input className="input" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
        <label className="mt-3 flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-green-700" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          Replace meals already planned on those days
        </label>
        <p className="mt-2 text-xs text-stone-500">
          Left unticked, the saved week only fills the empty slots — handy for finishing a half-planned week.
        </p>
        <button
          className="btn btn-primary mt-4 w-full"
          onClick={async () => {
            if (!applying) return;
            const added = await useTemplate(applying.id, target, replace);
            setApplying(null);
            toast(added ? `${added} meal${added === 1 ? '' : 's'} added` : 'Those days were already full');
          }}
        >
          Add to the plan
        </button>
      </Sheet>
    </>
  );
}
