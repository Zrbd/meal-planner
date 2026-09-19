// Which aisle belongs to which store, when you shop at more than one place.
import { Link } from 'react-router';
import { AISLES } from '../../data/aisles';
import { updateSettings } from '../../db/settings';
import { STORES, type StoreId } from '../../domain/stores';
import type { AisleId } from '../../domain/types';
import { PageHeader } from '../components';
import { useAppData } from '../data';

export function StorePlan() {
  const { settings, ingById } = useAppData();
  const primary = settings.store ?? 'walmart';
  const aisles = settings.storeAisles ?? {};
  const overrides = settings.storeOverrides ?? {};
  const choices = STORES.filter((s) => s.id !== 'none');

  const setAisle = (aisle: AisleId, store: StoreId | undefined) =>
    void updateSettings({ storeAisles: { ...aisles, [aisle]: store } });

  return (
    <>
      <PageHeader title="Shopping by store" subtitle="One list, split across your stops" back="/settings" />
      <div className="space-y-4 px-4 pb-8">
        <div className="card flex items-center justify-between p-3">
          <div className="pr-3">
            <div className="font-medium">Split the list by store</div>
            <p className="text-xs text-stone-500">The shopping list groups into a section per store, in the order you'll drive.</p>
          </div>
          <input
            type="checkbox"
            className="h-6 w-6 accent-[var(--brand)]"
            checked={!!settings.multiStore}
            onChange={(e) => void updateSettings({ multiStore: e.target.checked })}
          />
        </div>

        {settings.multiStore && (
          <>
            <section>
              <h2 className="section-title">🏬 Aisles</h2>
              <p className="-mt-1 px-1 pb-2 text-xs text-stone-500">
                Anything you leave on “{STORES.find((s) => s.id === primary)?.label ?? 'your main store'}” goes to your main store.
              </p>
              <ul className="card divide-y divide-stone-100">
                {AISLES.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 p-3">
                    <span className="min-w-0 flex-1 truncate font-medium">{a.emoji} {a.label}</span>
                    <select
                      className="input w-40 py-1.5 text-sm"
                      aria-label={`Store for ${a.label}`}
                      value={aisles[a.id] ?? primary}
                      onChange={(e) => setAisle(a.id, e.target.value as StoreId)}
                    >
                      {choices.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </section>

            {Object.keys(overrides).length > 0 && (
              <section>
                <h2 className="section-title">📌 Item exceptions</h2>
                <p className="-mt-1 px-1 pb-2 text-xs text-stone-500">These beat the aisle rule.</p>
                <ul className="card divide-y divide-stone-100">
                  {Object.entries(overrides).map(([id, store]) => (
                    <li key={id} className="flex items-center justify-between p-3">
                      <span className="min-w-0 flex-1 truncate font-medium">{ingById.get(id)?.name ?? id}</span>
                      <span className="text-sm text-stone-500">{STORES.find((s) => s.id === store)?.label}</span>
                      <button
                        className="ml-3 text-sm font-semibold text-red-600"
                        onClick={() => {
                          const next = { ...overrides };
                          delete next[id];
                          void updateSettings({ storeOverrides: next });
                        }}
                      >
                        Clear
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Link to="/shop" className="btn btn-primary w-full">See the split list</Link>
          </>
        )}
      </div>
    </>
  );
}
