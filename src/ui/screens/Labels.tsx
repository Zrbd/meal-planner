// Feature 11: printable labels for the freezer and the fridge. Also copies as plain text, for a
// label printer or just to read out while someone else writes on the tape.
import { Copy, Printer } from 'lucide-react';
import { useState } from 'react';
import { freezerLabel, labelSheet, labelText, lotLabel, type Label } from '../../domain/labels';
import { EmptyState, PageHeader, Segmented } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';

type Source = 'freezer' | 'fridge';

export function Labels() {
  const { freezer, lots, recipeById, ingById, today } = useAppData();
  const toast = useToast();
  const [source, setSource] = useState<Source>('freezer');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const rows: { key: string; label: Label }[] =
    source === 'freezer'
      ? freezer.map((m) => ({ key: m.id, label: freezerLabel(m, recipeById.get(m.recipeId)) }))
      : lots
          .filter((l) => l.qty > 0)
          .map((l) => ({ key: l.id, label: lotLabel(l, ingById.get(l.ingredientId), today) }));

  const selected = rows.filter((r) => picked.has(r.key));
  const toPrint = selected.length ? selected : rows;
  const pages = labelSheet(toPrint.map((r) => r.label));

  const toggle = (key: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      <PageHeader
        title="Labels"
        subtitle={`${toPrint.length} label${toPrint.length === 1 ? '' : 's'}`}
        back
        right={
          <button className="icon-btn print:hidden" aria-label="Print" onClick={() => window.print()} disabled={!toPrint.length}>
            <Printer size={22} />
          </button>
        }
      />
      <div className="space-y-4 px-4 pb-8">
        <div className="print:hidden">
          <Segmented
            value={source}
            onChange={(v) => {
              setSource(v);
              setPicked(new Set());
            }}
            options={[
              { value: 'freezer' as Source, label: 'Freezer' },
              { value: 'fridge' as Source, label: 'Pantry & fridge' },
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            emoji="🏷️"
            title="Nothing to label"
            body={source === 'freezer' ? 'Freeze some leftovers first.' : 'Add something to the pantry first.'}
          />
        ) : (
          <>
            <p className="text-xs text-stone-500 print:hidden">
              Tap to choose which labels to print. With nothing chosen, all of them print.
            </p>
            {pages.map((page, pi) => (
              <div key={pi} className="grid grid-cols-2 gap-3 break-after-page">
                {page.map((label, i) => {
                  const row = toPrint[pi * 8 + i];
                  const on = picked.has(row.key);
                  return (
                    <button
                      key={row.key}
                      onClick={() => toggle(row.key)}
                      className={`card p-3 text-left ${on ? 'ring-2 ring-brand' : ''}`}
                    >
                      <div className="text-sm leading-tight font-bold">{label.title}</div>
                      {label.detail && <div className="text-[11px] text-stone-500">{label.detail}</div>}
                      <div className="mt-1.5 text-[11px] font-medium">{label.packed}</div>
                      <div className="text-[11px] font-semibold text-amber-700">{label.useBy}</div>
                      {label.reheat && <div className="mt-1 text-[10px] leading-snug text-stone-500">{label.reheat}</div>}
                    </button>
                  );
                })}
              </div>
            ))}
            <button
              className="btn btn-secondary w-full print:hidden"
              onClick={async () => {
                await navigator.clipboard.writeText(toPrint.map((r) => labelText(r.label)).join('\n\n'));
                toast('Labels copied');
              }}
            >
              <Copy size={18} /> Copy as text
            </button>
          </>
        )}
      </div>
    </>
  );
}
