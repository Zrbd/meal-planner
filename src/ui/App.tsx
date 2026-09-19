import { BookOpen, CalendarDays, House, Refrigerator, ShoppingCart } from 'lucide-react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Suspense, lazy, useEffect, useState } from 'react';
import { pushNewAlerts, setBadge } from '../services/notify';
import { AppDataProvider, useAppData } from './data';
import { useAlerts } from './hooks';
import { Home } from './screens/Home';
import { Pantry } from './screens/Pantry';
import { Plan } from './screens/Plan';
import { RecipeDetail } from './screens/RecipeDetail';
import { Recipes } from './screens/Recipes';
import { Shopping } from './screens/Shopping';
import { ToastProvider } from './toast';

// Screens you reach from somewhere else, not on launch: loaded on demand to keep the first paint small.
const CookMode = lazy(() => import('./screens/CookMode').then((m) => ({ default: m.CookMode })));
const RecipeEditor = lazy(() => import('./screens/RecipeEditor').then((m) => ({ default: m.RecipeEditor })));
const SettingsScreen = lazy(() => import('./screens/Settings').then((m) => ({ default: m.SettingsScreen })));
const StockCheck = lazy(() => import('./screens/StockCheck').then((m) => ({ default: m.StockCheck })));
const Prep = lazy(() => import('./screens/Prep').then((m) => ({ default: m.Prep })));
const PantryItem = lazy(() => import('./screens/PantryItem').then((m) => ({ default: m.PantryItem })));
const Stats = lazy(() => import('./screens/Stats').then((m) => ({ default: m.Stats })));
const PriceBook = lazy(() => import('./screens/PriceBook').then((m) => ({ default: m.PriceBook })));
const FindByIngredient = lazy(() => import('./screens/FindByIngredient').then((m) => ({ default: m.FindByIngredient })));
const Collections = lazy(() => import('./screens/Collections').then((m) => ({ default: m.Collections })));
const Freezer = lazy(() => import('./screens/Freezer').then((m) => ({ default: m.Freezer })));
const MenuCard = lazy(() => import('./screens/MenuCard').then((m) => ({ default: m.MenuCard })));
const Timeline = lazy(() => import('./screens/Timeline').then((m) => ({ default: m.Timeline })));
const ExpiryCalendar = lazy(() => import('./screens/ExpiryCalendar').then((m) => ({ default: m.ExpiryCalendar })));
const Staples = lazy(() => import('./screens/Staples').then((m) => ({ default: m.Staples })));
const StorePlan = lazy(() => import('./screens/StorePlan').then((m) => ({ default: m.StorePlan })));

const TABS = [
  { to: '/', label: 'Today', icon: House },
  { to: '/recipes', label: 'Recipes', icon: BookOpen },
  { to: '/plan', label: 'Plan', icon: CalendarDays },
  { to: '/shop', label: 'Shop', icon: ShoppingCart },
  { to: '/pantry', label: 'Pantry', icon: Refrigerator },
];

const isTextField = (el: Element | null) =>
  !!el && ((el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'].includes(el.type)) ||
    el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

/**
 * True while the on-screen keyboard is up. iOS keeps fixed bars glued above the keyboard as you scroll,
 * covering the content, so bottom bars hide while typing. Also sets `html[data-kb]` for CSS.
 */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let blurTimer = 0;
    const vv = window.visualViewport;
    const update = () => {
      const shrunk = !!vv && vv.height < window.innerHeight * 0.8;
      const next = isTextField(document.activeElement) || shrunk;
      setOpen(next);
      if (next) document.documentElement.dataset.kb = '1';
      else delete document.documentElement.dataset.kb;
    };
    const onIn = () => { clearTimeout(blurTimer); update(); };
    // focus hops between fields fire out → in; wait a beat so the bar doesn't flicker
    const onOut = () => { blurTimer = window.setTimeout(update, 150); };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    vv?.addEventListener('resize', update);
    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
      vv?.removeEventListener('resize', update);
    };
  }, []);
  return open;
}

function TabBar() {
  const { pathname } = useLocation();
  const keyboard = useKeyboardOpen();
  if (keyboard || /\/(cook|edit|new|import)$/.test(pathname)) return null;
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium ${isActive ? 'text-brand' : 'text-stone-500'}`
            }
          >
            <t.icon size={23} strokeWidth={2} />
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Badge the app icon and send a notification digest for new alerts whenever the app is open. */
/** Feature 14: the whole app scales with one number, because rem sizes everything. */
function TextScale() {
  const { settings } = useAppData();
  const scale = settings.textScale ?? 1;
  useEffect(() => {
    document.documentElement.style.fontSize = scale === 1 ? '' : `${Math.round(16 * scale)}px`;
    return () => { document.documentElement.style.fontSize = ''; };
  }, [scale]);
  return null;
}

function NotificationBridge() {
  const { settings } = useAppData();
  const alerts = useAlerts();
  const key = alerts.map((a) => a.id).join('|');
  useEffect(() => {
    if (!settings.notifications) {
      void setBadge(0);
      return;
    }
    const run = () => {
      if (document.visibilityState !== 'visible') return;
      void setBadge(alerts.filter((a) => a.kind !== 'low').length);
      void pushNewAlerts(alerts).catch(() => {});
    };
    run();
    document.addEventListener('visibilitychange', run);
    return () => document.removeEventListener('visibilitychange', run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, settings.notifications]);
  return null;
}

function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="pt-safe fixed inset-x-0 top-0 z-[70] flex justify-center px-4">
      <div className="mt-2 flex items-center gap-3 rounded-2xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg">
        <span>A new version is ready.</span>
        <button className="font-semibold text-green-300" onClick={() => void updateServiceWorker(true)}>Update</button>
        <button className="text-stone-400" onClick={() => setNeedRefresh(false)}>Later</button>
      </div>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <AppDataProvider>
        <ToastProvider>
          <main className="mx-auto min-h-dvh max-w-xl pb-[calc(env(safe-area-inset-bottom)+5rem)]">
            <Suspense fallback={<div className="p-6 text-center text-sm text-stone-400">Loading…</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/recipes" element={<Recipes />} />
              <Route path="/recipes/new" element={<RecipeEditor />} />
              <Route path="/recipes/import" element={<RecipeEditor importMode />} />
              <Route path="/recipes/:id" element={<RecipeDetail />} />
              <Route path="/recipes/:id/edit" element={<RecipeEditor />} />
              <Route path="/recipes/:id/cook" element={<CookMode />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/shop" element={<Shopping />} />
              <Route path="/pantry" element={<Pantry />} />
              <Route path="/pantry/check" element={<StockCheck />} />
              <Route path="/pantry/:id" element={<PantryItem />} />
              <Route path="/prep" element={<Prep />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/prices" element={<PriceBook />} />
              <Route path="/find" element={<FindByIngredient />} />
              <Route path="/collections" element={<Collections />} />
              <Route path="/collections/:id" element={<Collections />} />
              <Route path="/freezer" element={<Freezer />} />
              <Route path="/menu" element={<MenuCard />} />
              <Route path="/timeline/:date" element={<Timeline />} />
              <Route path="/pantry/expiry" element={<ExpiryCalendar />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/settings/staples" element={<Staples />} />
              <Route path="/settings/stores" element={<StorePlan />} />
              <Route path="*" element={<Home />} />
            </Routes>
            </Suspense>
          </main>
          <TabBar />
          <UpdateBanner />
          <NotificationBridge />
          <TextScale />
        </ToastProvider>
      </AppDataProvider>
    </HashRouter>
  );
}
