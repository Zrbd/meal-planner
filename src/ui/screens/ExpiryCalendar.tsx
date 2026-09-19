// Three weeks of use-by dates at a glance, and what to cook to beat them.
import { useMemo } from 'react';
import { Link } from 'react-router';
import { formatDay, relativeDayLabel } from '../../domain/dates';
import { expiryCalendar, rescueRecipes } from '../../domain/expirycalendar';
import { formatQty } from '../../domain/units';
import { EmptyState, PageHeader, RecipeCard } from '../components';
import { useAppData } from '../data';
import { useCoverage } from '../hooks';

const LOCATION_EMOJI: Record<string, string> = { fridge: '🧊', freezer: '❄️', pantry: '🥫' };

export function ExpiryCalendar() {
  const d = useAppData();
  const coverage = useCoverage();
  const calendar = useMemo(
    () => expiryCalendar({ lots: d.lots, ingById: d.ingById, today: d.today }),
    [d.lots, d.ingById, d.today],
  );
  const rescue = useMemo(
    () => rescueRecipes({ calendar, recipes: d.recipes, limit: 6 }),
    [calendar, d.recipes],
  );

  const busyDays = calendar.days.filter((day) => day.items.length > 0);
  const qtyOf = (ingredientId: string, qty: number) => {
    const ing = d.ingById.get(ingredientId);
    return ing ? formatQty(qty, ing, d.settings.units) : String(qty);
  };

  return (
    <>
      <PageHeader title="Use it up" subtitle="The next three weeks" back="/pantry" />
      <div className="space-y-4 px-4 pb-8">
        {calendar.overdue.length === 0 && busyDays.length === 0 ? (
          <EmptyState
            emoji="🗓️"
            title="Nothing with a date on it"
            body={
              calendar.undatedCount > 0
                ? `You have ${calendar.undatedCount} item${calendar.undatedCount === 1 ? '' : 's'} in stock, but none of them have a use-by date yet. Add dates from the pantry and they'll show up here.`
                : 'Add some stock in the pantry and its dates will land on this calendar.'
            }
            action={<Link to="/pantry" className="btn btn-primary">Open the pantry</Link>}
          />
        ) : (
          <>
            {calendar.overdue.length > 0 && (
              <section>
                <h2 className="section-title text-red-600">⛔️ Past their date</h2>
                <ul className="card divide-y divide-stone-100">
                  {calendar.overdue.map((i) => (
                    <li key={i.lotId} className="flex items-center justify-between p-3">
                      <Link to={`/pantry/${i.ingredientId}`} className="min-w-0 flex-1">
                        <div className="truncate font-medium">{LOCATION_EMOJI[i.location]} {i.name}</div>
                        <div className="text-xs text-red-600">{formatDay(i.expiresOn, 'MMM d')} · {-i.daysLeft} day{i.daysLeft === -1 ? '' : 's'} ago</div>
                      </Link>
                      <span className="text-sm text-stone-500">{qtyOf(i.ingredientId, i.qty)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {busyDays.map((day) => (
              <section key={day.date}>
                <h2 className="section-title">
                  {relativeDayLabel(day.date, d.today)}
                  <span className="ml-2 font-normal text-stone-400">{formatDay(day.date, 'MMM d')}</span>
                </h2>
                <ul className="card divide-y divide-stone-100">
                  {day.items.map((i) => (
                    <li key={i.lotId} className="flex items-center justify-between p-3">
                      <Link to={`/pantry/${i.ingredientId}`} className="min-w-0 flex-1 truncate font-medium">
                        {LOCATION_EMOJI[i.location]} {i.name}
                      </Link>
                      <span className="text-sm text-stone-500">{qtyOf(i.ingredientId, i.qty)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {calendar.laterCount > 0 && (
              <p className="px-1 text-xs text-stone-500">
                {calendar.laterCount} more item{calendar.laterCount === 1 ? '' : 's'} keep{calendar.laterCount === 1 ? 's' : ''} beyond three weeks.
              </p>
            )}

            {rescue.length > 0 && (
              <section>
                <h2 className="section-title pt-2">🚑 Cook these and nothing goes to waste</h2>
                <div className="space-y-2">
                  {rescue.map(({ recipe, uses }) => (
                    <RecipeCard key={recipe.id} recipe={recipe} coverage={coverage.get(recipe.id)} subtitle={`Uses ${uses.join(', ')}`} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
