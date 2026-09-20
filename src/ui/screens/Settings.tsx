import { CalendarPlus, Download, RotateCcw, Upload, X } from 'lucide-react';
import { isInstalled, requestNotifications, shareReminders } from '../../services/notify';
import { useRef, useState, type ReactNode } from 'react';
import { importBackup, resetEverything, shareBackup } from '../../db/backup';
import { deviceStore } from '../../db/autobackup';
import { updateSettings } from '../../db/settings';
import { SLOTS, type SmokerMode } from '../../domain/types';
import { STORES, type StoreId } from '../../domain/stores';
import { Link } from 'react-router';
import { IngredientPicker, PageHeader, Segmented } from '../components';
import { useAppData } from '../data';
import { useToast } from '../toast';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DIETS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'];

function Stepper(props: { value: number; min?: number; max?: number; onChange: (n: number) => void; label: string }) {
  const { value, min = 0, max = 21 } = props;
  return (
    <div className="flex items-center gap-2">
      <button className="icon-btn h-8 w-8 bg-stone-100" aria-label={`Less ${props.label}`} disabled={value <= min} onClick={() => props.onChange(value - 1)}>−</button>
      <span className="w-6 text-center font-semibold">{value}</span>
      <button className="icon-btn h-8 w-8 bg-stone-100" aria-label={`More ${props.label}`} disabled={value >= max} onClick={() => props.onChange(value + 1)}>+</button>
    </div>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        {hint && <div className="text-xs text-stone-500">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const { settings: s, ingById, lastBackupAt, autoBackupAt, meals, recipeById, lots, loose, today } = useAppData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dislikeOpen, setDislikeOpen] = useState(false);
  const set = (patch: Parameters<typeof updateSettings>[0]) => void updateSettings(patch);

  return (
    <>
      <PageHeader title="Settings" back />
      <div className="space-y-1 px-4 pb-10">
        <h2 className="section-title">Household</h2>
        <div className="card divide-y divide-stone-100">
          <Row title="People eating" hint="Default servings for planned meals">
            <Stepper label="people" value={s.householdSize} min={1} max={12} onChange={(n) => set({ householdSize: n })} />
          </Row>
          {SLOTS.map((slot) => {
            const on = s.enabledSlots.includes(slot);
            return (
              <Row key={slot} title={`${slot[0].toUpperCase()}${slot.slice(1)}s per week`} hint={on ? undefined : 'Not planning this meal'}>
                <Stepper
                  label={slot}
                  value={on ? s.mealsPerWeek[slot] : 0}
                  max={7}
                  onChange={(n) =>
                    set({
                      mealsPerWeek: { ...s.mealsPerWeek, [slot]: n },
                      enabledSlots: n > 0 ? [...new Set([...s.enabledSlots, slot])] : s.enabledSlots.filter((x) => x !== slot),
                    })
                  }
                />
              </Row>
            );
          })}
          <Row title="Weeknight time limit" hint="Auto-fill picks quicker dinners Sun–Thu">
            <select className="input w-auto px-2 py-1.5" value={s.weeknightMaxMin} onChange={(e) => set({ weeknightMaxMin: Number(e.target.value) })}>
              {[0, 30, 45, 60].map((m) => <option key={m} value={m}>{m ? `${m} min` : 'No limit'}</option>)}
            </select>
          </Row>
        </div>

        <h2 className="section-title">Food preferences</h2>
        <div className="card space-y-3 p-3">
          <div>
            <div className="mb-2 text-sm text-stone-600">Only suggest recipes that are:</div>
            <div className="flex flex-wrap gap-2">
              {DIETS.map((d) => (
                <button key={d} className={`chip capitalize ${s.dietFilters.includes(d) ? 'chip-on' : ''}`}
                  onClick={() => set({ dietFilters: s.dietFilters.includes(d) ? s.dietFilters.filter((x) => x !== d) : [...s.dietFilters, d] })}>
                  {d.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm text-stone-600">Never suggest recipes with:</div>
            <div className="flex flex-wrap gap-2">
              {s.dislikedIngredients.map((id) => (
                <button key={id} className="chip" onClick={() => set({ dislikedIngredients: s.dislikedIngredients.filter((x) => x !== id) })}>
                  {ingById.get(id)?.name ?? id} <X size={14} />
                </button>
              ))}
              <button className="chip border-dashed text-brand" onClick={() => setDislikeOpen(true)}>+ Add</button>
            </div>
          </div>
        </div>

        <h2 className="section-title">Shopping</h2>
        <div className="card divide-y divide-stone-100">
          <Row title="Usual shopping day">
            <select className="input w-auto px-2 py-1.5" value={s.shoppingDay} onChange={(e) => set({ shoppingDay: Number(e.target.value) })}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </Row>
          <Row title="Week starts on">
            <div className="w-36">
              <Segmented value={String(s.weekStartsOn)} options={[{ value: '0', label: 'Sun' }, { value: '1', label: 'Mon' }]} onChange={(v) => set({ weekStartsOn: Number(v) as 0 | 1 })} />
            </div>
          </Row>
          <Row title="Low-stock warning" hint="Warn when an item will run out within this many days">
            <Stepper label="days" value={s.bufferDays} min={1} max={14} onChange={(n) => set({ bufferDays: n })} />
          </Row>
          <Row title="Store links" hint="Tap an item on your list to look it up here">
            <select className="input w-auto px-2 py-1.5" value={s.store ?? 'walmart'} onChange={(e) => set({ store: e.target.value as StoreId })}>
              {STORES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
            </select>
          </Row>
          <Row title="Weekly grocery budget" hint="Shows a bar on your shopping list. 0 turns it off.">
            <div className="flex items-center gap-1">
              <span className="text-stone-400">$</span>
              <input
                className="input w-20 px-2 py-1.5 text-right"
                type="number"
                inputMode="decimal"
                min={0}
                step={5}
                value={s.weeklyBudget || ''}
                placeholder="0"
                onChange={(e) => set({ weeklyBudget: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
          </Row>
          <Row title="Shopping by store" hint="Split one list across the two or three places you shop">
            <Link className="btn btn-secondary px-3 py-1.5" to="/settings/stores">{s.multiStore ? 'On' : 'Set up'}</Link>
          </Row>
          <Row title="Price book" hint="Every price you've typed in, and what's gone up">
            <Link className="btn btn-secondary px-3 py-1.5" to="/prices">Open</Link>
          </Row>
          <Row title="Text size" hint="Scales the whole app, not just the recipe">
            <div className="w-44">
              <Segmented
                value={(s.textScale ?? 1) >= 1.25 ? 'xl' : (s.textScale ?? 1) >= 1.1 ? 'lg' : 'md'}
                options={[{ value: 'md', label: 'Normal' }, { value: 'lg', label: 'Large' }, { value: 'xl', label: 'Largest' }]}
                onChange={(v) => set({ textScale: v === 'md' ? 1 : v === 'lg' ? 1.15 : 1.3 })}
              />
            </div>
          </Row>
          <Row title="Units">
            <div className="w-36">
              <Segmented value={s.units} options={[{ value: 'us', label: 'US' }, { value: 'metric', label: 'Metric' }]} onChange={(v) => set({ units: v })} />
            </div>
          </Row>
        </div>

        <h2 className="section-title">Auto-plan</h2>
        <div className="card divide-y divide-stone-100">
          <Row title="Lean on the pantry" hint="How much of a recipe you need on hand before it gets suggested">
            <div className="w-40">
              <Segmented
                value={(s.pantryPull ?? 0.35) >= 0.55 ? 'high' : (s.pantryPull ?? 0.35) >= 0.3 ? 'mid' : 'low'}
                options={[{ value: 'low', label: 'Any' }, { value: 'mid', label: 'Some' }, { value: 'high', label: 'Most' }]}
                onChange={(v) => set({ pantryPull: v === 'low' ? 0.15 : v === 'mid' ? 0.35 : 0.6 })}
              />
            </div>
          </Row>
          <Row title="Plan a side with dinner" hint="Adds a side dish that goes with each main">
            <input type="checkbox" className="h-6 w-6 accent-brand" checked={s.planSides !== false} onChange={(e) => set({ planSides: e.target.checked })} />
          </Row>
          <Row title="Smoker recipes">
            <div className="w-44">
              <Segmented
                value={s.smoker ?? 'weekends'}
                options={[{ value: 'off', label: 'Never' }, { value: 'weekends', label: 'Weekends' }, { value: 'any', label: 'Any day' }]}
                onChange={(v) => set({ smoker: v as SmokerMode })}
              />
            </div>
          </Row>
          <Row title="Ask before smoking" hint="Check with you when a smoker recipe lands in the plan">
            <input type="checkbox" className="h-6 w-6 accent-brand" checked={s.smokerConfirm !== false} onChange={(e) => set({ smokerConfirm: e.target.checked })} />
          </Row>
        </div>

        <h2 className="section-title">Pantry</h2>
        <div className="card divide-y divide-stone-100">
          <Row title="Stock check" hint="Go through your kitchen one ingredient at a time">
            <Link className="btn btn-secondary px-3 py-1.5" to="/pantry/check">Start</Link>
          </Row>
          <Row title="Staples" hint="Things that should always be in the house">
            <Link className="btn btn-secondary px-3 py-1.5" to="/settings/staples">Open</Link>
          </Row>
          <Row title="Use it up" hint="Three weeks of use-by dates, and what to cook to beat them">
            <Link className="btn btn-secondary px-3 py-1.5" to="/pantry/expiry">Open</Link>
          </Row>
          <Row title="Fridge sweep" hint="Walk the fridge one item at a time: keep, use now, or bin">
            <Link className="btn btn-secondary px-3 py-1.5" to="/pantry/sweep">Open</Link>
          </Row>
          <Row title="Freezer" hint="Cooked portions waiting for a night off">
            <Link className="btn btn-secondary px-3 py-1.5" to="/freezer">Open</Link>
          </Row>
        </div>

        <h2 className="section-title">Your kitchen</h2>
        <div className="card divide-y divide-stone-100">
          <Row title="Allergies, gear, theme, cooks" hint="What to avoid, what you own, dark mode, who cooks with you">
            <Link className="btn btn-secondary px-3 py-1.5" to="/settings/kitchen">Open</Link>
          </Row>
          <Row title="Nutrition" hint="What the week adds up to, and your daily goals">
            <Link className="btn btn-secondary px-3 py-1.5" to="/nutrition">Open</Link>
          </Row>
          <Row title="Kitchen cheat sheet" hint="Conversions, oven temperatures, doneness, emergency swaps">
            <Link className="btn btn-secondary px-3 py-1.5" to="/cheatsheet">Open</Link>
          </Row>
          <Row title="Which is cheaper?" hint="Unit-price calculator with waste factored in">
            <Link className="btn btn-secondary px-3 py-1.5" to="/prices/compare">Open</Link>
          </Row>
          <Row title="Freezer & leftover labels" hint="Printable labels with the date to eat it by">
            <Link className="btn btn-secondary px-3 py-1.5" to="/labels">Open</Link>
          </Row>
          <Row title="Add a shared recipe" hint="Open a recipe file someone sent you">
            <Link className="btn btn-secondary px-3 py-1.5" to="/recipes/receive">Open</Link>
          </Row>
        </div>

        <h2 className="section-title">Looking back</h2>
        <div className="card divide-y divide-stone-100">
          <Row title="Kitchen badges" hint="Habits worth keeping, counted up">
            <Link className="btn btn-secondary px-3 py-1.5" to="/badges">Open</Link>
          </Row>
          <Row title="Kitchen stats" hint="What you cook, what it costs, what gets thrown out">
            <Link className="btn btn-secondary px-3 py-1.5" to="/stats">Open</Link>
          </Row>
          <Row title="Collections" hint="Your own shelves of recipes">
            <Link className="btn btn-secondary px-3 py-1.5" to="/collections">Open</Link>
          </Row>
        </div>

        <h2 className="section-title">Reminders</h2>
        <div className="card space-y-3 p-3">
          <Row title="Phone notifications" hint="Thawing, food to use up, expiring and running-out items">
            <input
              type="checkbox"
              role="switch"
              className="h-6 w-6 accent-[var(--color-brand)]"
              checked={s.notifications}
              onChange={async (e) => {
                if (!e.target.checked) return set({ notifications: false });
                const perm = await requestNotifications();
                if (perm === 'granted') {
                  set({ notifications: true });
                  toast('Notifications on');
                } else if (perm === 'unsupported') {
                  toast(isInstalled() ? 'This phone doesn’t support web notifications' : 'Add the app to your Home Screen first');
                } else toast('Notifications are blocked — allow them in iPhone Settings › Notifications');
              }}
            />
          </Row>
          <p className="text-xs leading-relaxed text-stone-500">
            iPhone only lets web apps notify you while they're open, so you'll get a summary (and a red badge on the app icon) each time you
            open it. For reminders at a set time — like “thaw the chicken tonight” — add them to your calendar:
          </p>
          <button
            className="btn btn-secondary w-full"
            onClick={async () => {
              const r = await shareReminders({ meals, recipesById: recipeById, ingById, lots, loose, today, shoppingDay: s.shoppingDay });
              if (r === 'empty') toast('Nothing to remind you about this week');
              else if (r !== 'cancelled') toast('Open the file and tap “Add All” in Calendar');
            }}
          >
            <CalendarPlus size={18} /> Add this week's reminders to Calendar
          </button>
        </div>

        <h2 className="section-title">Your data</h2>
        <div className="card space-y-2 p-3">
          <p className="text-sm text-stone-600">
            Everything is stored on this phone only. iPhone may clear website data if the app goes unused for a while, so save a backup
            to Files or iCloud Drive now and then.
          </p>
          <p className="text-xs text-stone-500">
            Last backup file: {lastBackupAt ? new Date(lastBackupAt).toLocaleDateString() : 'never'}
          </p>
          <p className="text-xs text-stone-500">
            Automatic backup: {autoBackupAt ? new Date(autoBackupAt).toLocaleString() : 'not yet'}. A copy is saved every time you open or
            leave the app, and if the app's data ever disappears it's restored from that copy automatically. It lives on this phone
            too, so a backup file is still the safest bet if you delete the app.
          </p>
          <button
            className="btn btn-primary w-full"
            onClick={async () => {
              const r = await shareBackup();
              if (r !== 'cancelled') toast('Backup saved');
            }}
          >
            <Download size={18} /> Save a backup
          </button>
          <button className="btn btn-secondary w-full" onClick={() => fileRef.current?.click()}>
            <Upload size={18} /> Restore from backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (!window.confirm('Restoring replaces everything in the app with the backup. Continue?')) return;
              try {
                await importBackup(await file.text());
                toast('Backup restored');
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Restore failed');
              }
            }}
          />
          <button
            className="btn btn-danger w-full"
            onClick={async () => {
              if (!window.confirm('Erase your pantry, plans, and your own recipes? This cannot be undone.')) return;
              if (!window.confirm('Really erase everything?')) return;
              // clear the automatic copy first, or the next launch would "restore" what you just erased
              await deviceStore.clear();
              await resetEverything();
              toast('App reset');
            }}
          >
            <RotateCcw size={18} /> Start over
          </button>
        </div>

        <h2 className="section-title">Install on iPhone</h2>
        <div className="card p-3 text-sm text-stone-600">
          Open this page in Safari, tap the <b>Share</b> button, then <b>Add to Home Screen</b>. It opens full-screen and works offline.
        </div>
      </div>

      <IngredientPicker
        open={dislikeOpen}
        onClose={() => setDislikeOpen(false)}
        title="Never suggest…"
        onPick={(id) => set({ dislikedIngredients: [...new Set([...s.dislikedIngredients, id])] })}
      />
    </>
  );
}
