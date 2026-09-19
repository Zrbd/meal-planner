// The week as a menu you can print, stick on the fridge, and point at.
import { Printer, Share } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { addDaysISO, startOfWeekISO } from '../../domain/dates';
import { buildMenuCard, menuCardText } from '../../domain/menucard';
import { EmptyState, PageHeader } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';

export function MenuCard() {
  const { meals, recipeById, today, settings } = useAppData();
  const toast = useToast();
  const [params] = useSearchParams();
  const from = params.get('w') ?? startOfWeekISO(today, settings.weekStartsOn ?? 0);
  const to = addDaysISO(from, 6);

  const card = useMemo(
    () => buildMenuCard({ from, to, meals, recipeById, includeSides: true }),
    [from, to, meals, recipeById],
  );
  const anything = card.days.some((d) => d.entries.length > 0);

  const share = async () => {
    const text = menuCardText(card);
    try {
      if (navigator.share) await navigator.share({ title: 'This week’s menu', text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Menu copied');
      }
    } catch {
      /* the user backed out of the share sheet */
    }
  };

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Menu card"
          subtitle={card.heading}
          back="/plan"
          right={
            <div className="flex gap-1">
              <button className="icon-btn" aria-label="Share" onClick={() => void share()}><Share size={19} /></button>
              <button className="icon-btn" aria-label="Print" onClick={() => window.print()}><Printer size={19} /></button>
            </div>
          }
        />
      </div>

      <div className="px-4 pb-8">
        {!anything ? (
          <EmptyState emoji="🗒️" title="Nothing planned this week" body="Plan a few dinners and they'll show up here as a menu." />
        ) : (
          <article className="card border border-stone-200 p-5 print:border-0 print:shadow-none">
            <header className="border-b-2 border-stone-900 pb-2 text-center">
              <h1 className="text-xl font-bold tracking-tight">This week’s menu</h1>
              <p className="text-sm text-stone-500">{card.heading}</p>
            </header>
            <ul className="divide-y divide-stone-100">
              {card.days.map((day) => (
                <li key={day.date} className="flex gap-3 py-3">
                  <div className="w-24 shrink-0 text-sm font-semibold">{day.label}</div>
                  <div className="min-w-0 flex-1">
                    {day.entries.length === 0 ? (
                      <span className="text-sm text-stone-400">—</span>
                    ) : (
                      day.entries.map((e, i) => (
                        <div key={`${e.title}-${i}`} className={`text-sm ${e.skipped ? 'text-stone-400 line-through' : ''}`}>
                          {e.title}
                          <span className="ml-2 text-xs text-stone-400">{e.note}</span>
                        </div>
                      ))
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </article>
        )}
        <p className="px-1 pt-3 text-xs text-stone-500 print:hidden">
          Print gives you just the card — the app's chrome stays off the page.
        </p>
      </div>
    </>
  );
}
