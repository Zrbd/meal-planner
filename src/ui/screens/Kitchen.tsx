// Features 2, 7, 8, 9 and 14 share one screen: the things that describe *your* kitchen rather
// than the app's behaviour — who eats here, what you own, how it should look and sound.
import { updateSettings } from '../../db/settings';
import { ALLERGENS, type AllergenId } from '../../domain/allergens';
import { equipmentById } from '../../domain/dishes';
import { ASSUMED_OWNED, OPTIONAL_EQUIPMENT } from '../../domain/equipment';
import { PageHeader, Segmented } from '../components';
import { useAppData } from '../data';

export function Kitchen() {
  const { settings } = useAppData();
  const avoiding = (settings.avoidAllergens ?? []) as AllergenId[];
  const owned = new Set(settings.equipment ?? [...ASSUMED_OWNED, ...OPTIONAL_EQUIPMENT]);
  const cooks = settings.cookNames ?? [];

  const toggleAllergen = (id: AllergenId) =>
    void updateSettings({ avoidAllergens: avoiding.includes(id) ? avoiding.filter((a) => a !== id) : [...avoiding, id] });

  const toggleGear = (id: string) => {
    const next = new Set(owned);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    void updateSettings({ equipment: [...next] });
  };

  return (
    <>
      <PageHeader title="Your kitchen" subtitle="Who eats here, what you own, how it looks" back="/settings" />
      <div className="space-y-4 px-4 pb-8">
        <section className="card p-4">
          <div className="section-title pt-0">Appearance</div>
          <Segmented
            value={settings.theme ?? 'system'}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={(v) => void updateSettings({ theme: v })}
          />
          <p className="mt-2 text-xs text-stone-500">
            Auto follows your phone, so the shopping list goes dark with everything else at night.
          </p>
        </section>

        <section className="card p-4">
          <div className="section-title pt-0">Things to avoid</div>
          <p className="mb-3 text-xs text-stone-500">
            Recipes containing these get a warning before you cook and before you plan. Nothing is hidden outright — an
            allergy in the house is not the same as everyone's.
          </p>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => {
              const on = avoiding.includes(a.id);
              return (
                <button
                  key={a.id}
                  className={`chip ${on ? 'bg-red-50 font-semibold text-red-700' : ''}`}
                  onClick={() => toggleAllergen(a.id)}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="card p-4">
          <div className="section-title pt-0">Gear you own</div>
          <p className="mb-3 text-xs text-stone-500">
            Pots, pans and sheet trays are assumed. Untick anything here and recipes that need it say so up front.
          </p>
          <ul className="divide-y divide-stone-100">
            {OPTIONAL_EQUIPMENT.map((id) => (
              <li key={id}>
                <label className="flex items-center gap-3 py-2.5 text-sm">
                  <input type="checkbox" className="h-5 w-5 accent-green-700" checked={owned.has(id)} onChange={() => toggleGear(id)} />
                  {equipmentById(id)?.label ?? id}
                </label>
              </li>
            ))}
          </ul>
          <label className="mt-2 flex items-center gap-3 border-t border-stone-100 pt-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-green-700"
              checked={!!settings.equipmentFilter}
              onChange={(e) => void updateSettings({ equipmentFilter: e.target.checked })}
            />
            Hide recipes I can't make with this gear
          </label>
        </section>

        <section className="card p-4">
          <div className="section-title pt-0">Who cooks</div>
          <p className="mb-3 text-xs text-stone-500">
            Name the people in the kitchen and the cooking timeline splits itself between you — one lane each, nobody
            waiting on the same pan.
          </p>
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              className="input mb-2"
              placeholder={i === 0 ? 'You' : `Cook ${i + 1}`}
              value={cooks[i] ?? ''}
              onChange={(e) => {
                const next = [...cooks];
                next[i] = e.target.value;
                void updateSettings({ cookNames: next.filter((n, j) => n.trim() !== '' || j < next.length - 1) });
              }}
            />
          ))}
        </section>

        <section className="card p-4">
          <div className="section-title pt-0">Read steps aloud</div>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-green-700"
              checked={!!settings.readAloud}
              onChange={(e) => void updateSettings({ readAloud: e.target.checked })}
            />
            Speak each step in cook mode
          </label>
          <p className="mt-2 text-xs text-stone-500">For when your hands are covered in flour and the screen has locked itself again.</p>
          <label className="mt-3 block">
            <span className="label">Speed · {(settings.speechRate ?? 1).toFixed(1)}×</span>
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.1}
              className="w-full accent-green-700"
              value={settings.speechRate ?? 1}
              onChange={(e) => void updateSettings({ speechRate: Number(e.target.value) })}
            />
          </label>
        </section>
      </div>
    </>
  );
}
