# Meal Planner — Technical Plan

> Saved from the planning conversation (2026-09-12). Product scope: [PRODUCT_PLAN.md](PRODUCT_PLAN.md).
> Build status & deviations from this plan: [PROGRESS.md](PROGRESS.md).

## 1. Architecture

```
┌──────────────────────── iPhone (Home Screen PWA) ────────────────────────┐
│  UI (React screens)  →  hooks (live queries)  →  services (DB writes)     │
│                                   ↓                    ↓                  │
│                     domain/ (pure logic: units, stock, shopping,          │
│                              forecast, autoplan)  ← fully unit-tested     │
│                                   ↓                                       │
│                     IndexedDB via Dexie  (single source of truth)         │
│  Service worker (Workbox): precaches the whole app → works offline        │
└──────────────────────────────────────────────────────────────────────────┘
```

**Principles**
- **DB is the single source of truth.** Screens read through Dexie `useLiveQuery`, so any write (cook a meal, check an item) updates every screen automatically. No Redux, no duplicated state.
- **All logic lives in `domain/` as pure functions** — no React, no DB. Plain data in, results out. This is where the tricky math is and it's 100% unit-testable.
- **Services own writes**, each as one atomic Dexie transaction (e.g. "cook meal" can't half-deduct the pantry).
- **Derived data is never stored.** Shopping list, low-stock status, alerts are recomputed from plan + pantry (data is tiny — hundreds of rows — so this is milliseconds and can never go stale).

**Stack:** Vite · React · TypeScript · `react-router` (HashRouter — no server config needed for hosting) · `dexie` + `dexie-react-hooks` · `zustand` (only for ephemeral UI state, if needed) · `date-fns` · `zod` (import/backup validation) · `fuse.js` (fuzzy ingredient search) · Tailwind · `lucide-react` icons · `vite-plugin-pwa` · `vitest` + `fake-indexeddb` · Playwright WebKit at iPhone viewport (later).

## 2. Folder structure

```
src/
  main.tsx, App.tsx          router + bottom-tab layout
  db/        schema.ts  seed.ts  backup.ts
  domain/    types.ts
             units.ts        unit conversion + friendly formatting
             stock.ts        ★ lot allocation simulator (shared core)
             packages.ts     pack-size optimizer
             shopping.ts     shopping list builder
             forecast.ts     low-stock / run-out / expiry
             coverage.ts     "what can I make"
             autoplan.ts     meal plan generator
             parse.ts        "2 ½ cups flour" text parser
             dates.ts        local-date helpers (never UTC)
  services/  cook.ts  trip.ts  pantry.ts  plan.ts  recipes.ts
  hooks/     data provider + derived hooks
  features/  home/ recipes/ plan/ shopping/ pantry/ cook/ settings/
  components/ TabBar, Sheet, QtyInput, IngredientPicker, RecipeCard, …
  data/      ingredients.ts  aisles.ts  recipes/*.ts   (bundled seed content)
```

## 3. Data model

```ts
type BaseUnit = 'g' | 'ml' | 'ea';
type Location = 'pantry' | 'fridge' | 'freezer';
type Slot = 'breakfast' | 'lunch' | 'dinner';
type ISODate = string;            // 'YYYY-MM-DD', always local time

interface Ingredient {
  id: string;                     // slug: 'yellow-onion'
  name: string; aliases: string[];
  aisle: AisleId;
  baseUnit: BaseUnit;             // how stock is counted
  density?: number;               // g per ml   (bridges volume ↔ mass)
  gramsPerEach?: number;          // bridges count ↔ mass
  unitAliases?: Record<string, number>; // {clove: 5, stick: 113, can: 1} in baseUnit
  packages: { label: string; qty: number }[]; // what stores sell, in baseUnit
  shelfLife: Partial<Record<Location, number>>; // days
  defaultLocation: Location;
  trackMode: 'exact' | 'loose';   // loose = spices/salt/oil: plenty/low/out only
  keepStocked: boolean;           // restock even if no recipe needs it
  lowThreshold?: number;          // baseUnit; undefined = auto
  valueWeight: 1 | 2 | 3;         // cheap produce=1 … meat=3 (planner weighting)
  source: 'builtin' | 'user';
}

interface Recipe {
  id: string; title: string; description: string;
  baseServings: number; prepMin: number; cookMin: number; difficulty: 1|2|3;
  cuisine: string; protein?: string; diet: string[]; slots: Slot[];
  ingredients: { ingredientId: string; qty: number; unit: string;
                 prep?: string; optional?: boolean; group?: string }[];
  steps: { text: string; timerSec?: number }[];
  nutrition?: { kcal: number; protein: number; carbs: number; fat: number };
  favorite: boolean; rating?: number; archived: boolean;
  source: 'builtin' | 'user'; userEdited: boolean; photo?: Blob;
}

interface StockLot {              // one purchase of one thing
  id: string; ingredientId: string; qty: number; // baseUnit
  location: Location; addedAt: number; expiresOn?: ISODate;
}
interface LooseStock { ingredientId: string; level: 'plenty' | 'low' | 'out'; }

interface InventoryTxn {          // every change, forever
  id: string; ingredientId: string; delta: number;
  reason: 'purchase' | 'cook' | 'adjust' | 'waste';
  refId?: string;                 // plannedMealId or tripId (enables undo)
  lotSnapshot?: { lotId: string; expiresOn?: ISODate; location: Location; addedAt: number };
  at: number;
}

interface PlannedMeal {
  id: string; date: ISODate; slot: Slot; recipeId: string; servings: number;
  status: 'planned' | 'cooked' | 'skipped'; leftoverOf?: string;
}
interface CookLog { id: string; recipeId: string; plannedMealId?: string; at: number;
                    used: { ingredientId: string; qty: number }[]; }  // snapshot

interface ShoppingState { key: string; checked: boolean; haveIt?: boolean;
                          qtyOverride?: number; manualName?: string; }
interface Trip { id: string; range: [ISODate, ISODate]; finishedAt: number; lines: TripLine[]; }
```

**Dexie schema**
```ts
db.version(1).stores({
  ingredients:  'id, aisle, *aliases',
  recipes:      'id, title, favorite, cuisine, protein, archived',
  stockLots:    'id, ingredientId, location, expiresOn',
  looseStock:   'ingredientId',
  txns:         'id, ingredientId, at, refId, [ingredientId+at]',
  plannedMeals: 'id, date, [date+slot], recipeId, status',
  cookLog:      'id, recipeId, at',
  shoppingState:'key',
  trips:        'id, finishedAt',
  kv:           'key'            // settings, seedVersion, lastBackupAt
});
```

**Settings (in `kv`):** householdSize, units (us/metric), weekStartsOn, shoppingDay, enabledSlots + mealsPerWeek per slot, weeknightMaxMin, dietFilters, dislikedIngredients, aisleOrder, bufferDays.

## 4. Units engine (`units.ts`)

Every quantity converts to the ingredient's **base unit** before any math.

```
toBase(qty, unit, ingredient):
  1. unit in ingredient.unitAliases      → qty × alias           ("3 cloves" → 15 g)
  2. global table                        → g / ml / ea           (cup=236.6 ml, lb=453.6 g)
  3. same dimension as baseUnit          → done
  4. bridge dimensions:
       volume→mass  × density            ("1 cup flour" → 120 g)
       count→mass   × gramsPerEach       ("2 onions" → 300 g)
       (and reverse)
  5. else throw ConversionError
```

- **Display:** `formatQty(base, ingredient, prefs)` picks a friendly unit — US: 454 g → "1 lb", 14.8 ml → "1 tbsp"; fractions snap to ¼ ⅓ ½ ⅔ ¾; counts say "2".
- **Rounding:** base quantities rounded to 3 decimals; < 0.5 g/ml or < 0.05 ea treated as zero.
- **Guard test:** a Vitest test iterates **every seed recipe** and fails if any ingredient can't convert.
- **User recipes:** if the editor hits an unconvertible unit ("1 bunch kale"), it asks once "About how much is 1 bunch?" and saves it as a `unitAlias`.

## 5. The core primitive: stock allocation simulator (`stock.ts`)

Shopping, cooking, forecasts, "what can I make" and auto-plan all ask the same question — *given my lots and these meals in date order, who gets what, and what's short?* — so it's written once:

```ts
simulate(lots, loose, demands, ingredientsById) → {
  allocations: Map<demandId, {lotId, qty}[]>,
  shortfalls:  Map<demandId, qty>,
  remaining:   StockLot[]
}
// Demand = { id, date, slotOrder, ingredientId, qty(base) }
//   built from recipes scaled by servings / baseServings
```

Algorithm: sort demands by date → slot; for each, draw from lots **still unexpired on that meal's date**, soonest-expiry first then oldest; uncovered remainder = shortfall attributed to that meal. Loose items don't allocate; they're short only when level = `out`.

## 6. Shopping list (`shopping.ts`)

```
buildShoppingList(range [from, to]):
  1. demands = planned meals from min(TODAY, from) … to
     (meals before `from` consume stock first but their shortfalls aren't listed)
  2. result = simulate(lots, loose, demands)
  3. need[ing] = Σ shortfalls for meals inside range (remember which meals)
  4. loose items used in range: out → add 1 package; low/unknown → "double-check" section
  5. restock: keepStocked items whose remaining-after-range < threshold → top up
  6. round to packages (packages.ts)
  7. leftover = bought − need → perishable leftover > 25% of a pack → "use it up" suggestions
  8. apply shoppingState: haveIt hides, qtyOverride, manual items
  9. group by aisle in settings.aisleOrder, sort by name
```

**Pack optimizer:** ≤ 4 package sizes per item → enumerate combos; pick **least overbuy**, tie-break fewer packages. No packages defined → exact amount, friendly-rounded.

**Check state** is keyed by ingredientId in `shoppingState`, so editing the plan mid-trip recomputes the list without losing checkmarks.

**Share:** plain-text list via `navigator.share` → iOS share sheet.

## 7. Write operations (services, each atomic)

**Finish trip** — review sheet of checked items with *actual bought qty* (editable) → for each: new `StockLot` (location = default, expiresOn = today + shelfLife[location]) + `purchase` txn; loose items → `plenty`; manual items archived; `Trip` snapshot saved; checks cleared.

**Cook meal** — compute scaled needs → review sheet (edit amounts, uncheck "didn't use", mark loose items low/out) → FIFO deduct (same order as simulator), delete emptied lots; if pantry had less than used, deduct what exists and surface "Pantry was off for eggs — corrected" → `cook` txns with `refId` + `lotSnapshot` → meal `cooked` + `CookLog`. **Undo** reverses txns and restores lots with original expiry. "Cook this now" from a recipe creates a today meal then runs the same flow.

**Pantry actions** — set amount (adjust txn = diff), used some (FIFO), ran out (zero all lots), tossed (`waste`, excluded from usage rate), move to freezer (re-derive expiry from freezer shelf life), quick-add text ("2 lb chicken breast" via `parse.ts` + fuzzy match).

## 8. Forecasts & alerts (`forecast.ts`)

Per exact-tracked ingredient:
```
onHand       = Σ lots
dailyRate    = (cook + negative adjust txns, last 28 days; last 14 days weighted ×2;
                window = clamp(days since first txn, 7, 28); waste excluded)
daysLeft     = onHand / dailyRate
threshold    = user value ?? max(25% of smallest package, dailyRate × bufferDays)
```
Status priority: `out` → `short-for-plan` (simulator shortfall before next shopping day) → `low` (below threshold or daysLeft < bufferDays) → `ok`. Separately: `expiring` (lot expires ≤ 2 days) and `expired` (Toss / Still good +3 days). `useAlerts()` merges these for Home and Pantry badges. Pantry item page: on-hand, run-out date, history.

## 9. What can I make (`coverage.ts`)

For each recipe, simulate against current stock → **coverage = share of required ingredients fully covered, weighted by valueWeight** (loose count as covered unless `out`; optional ignored). Sort by coverage then fewest missing; show "Missing 2: lime, cilantro".

## 10. Auto-plan (`autoplan.ts`)

Input: date range, slots to fill, locked meals, filters (diet, dislikes, slot, weeknight time limit). **Greedy fill in date order**, updating a simulated pantry after each pick (its needs consumed; pack-rounding leftovers of bought perishables become available for later picks).

```
score(recipe) =
  + 3.0 × pantryCoverage            use what you have
  + 4.0 × expiringUse               rescue soon-to-expire food
  + 2.5 × perishableOverlap         shares cilantro/cream with other picks → less waste
  + 1.5 × favorite  + 0.5 × (rating − 3)
  − 3.0 × recency                   cooked in last 14 days (decays)
  − 2.0 × same protein as neighboring day
  − 1.0 × same cuisine as neighboring day
  + jitter(0–0.3, seeded)           "Shuffle" gives a new valid plan
```
"Swap this meal" re-scores just that slot excluding the current recipe. Weights live in one config const. Deterministic with a fixed seed for tests. **Leftovers:** "make extra for lunch tomorrow" bumps the source meal's servings and adds a `leftoverOf` meal that needs no ingredients.

## 11. Screens & routes

| Route | Screen |
|---|---|
| `/` | Home: tonight, week strip, alerts, "Cook tonight" |
| `/recipes`, `/recipes/:id`, `/recipes/new`, `/recipes/:id/edit`, `/recipes/import` | Browse (search, filters, "can make now"), detail (servings scaler), editor, paste import |
| `/recipes/:id/cook` | Cook mode |
| `/plan?week=` | Week grid: add/swap/lock/servings/leftovers, Auto-fill, Shuffle |
| `/shopping` | Range presets (This week / Next 3 days / Custom), aisle groups, Finish trip |
| `/pantry`, `/pantry/:ingredientId` | Inventory by location, item detail + history, quick add |
| `/settings` | Preferences, backup export/import |

**Cook mode:** one big step at a time; timers store `endAt` timestamps (survive app switching), chime via Web Audio (unlocked on first tap); Screen Wake Lock API with fallback.

## 12. PWA & iOS specifics

- `vite-plugin-pwa` precaches all assets → full offline. `registerType: 'prompt'` → **"Update available"** toast instead of silent reloads.
- Manifest: `display: standalone`, 180/192/512 + maskable icons, `apple-mobile-web-app-*` meta.
- `viewport-fit=cover` + `env(safe-area-inset-bottom)` padding for the tab bar; inputs ≥ 16px to stop iOS auto-zoom.
- `navigator.storage.persist()` on launch; **backup** = JSON export of all tables via share sheet → Files/iCloud; import validated with zod; banner if last backup > 14 days.
- **Seed migrations:** bundled `SEED_VERSION`; on launch newer seeds upsert builtin ingredients/recipes **only where not user-edited**; never touch user data. Schema changes via Dexie `version().upgrade()`.
- Recipe images: generated gradient cards + cuisine emoji (no copyright issues, tiny bundle); user photos compressed to ~200 KB Blobs.
- Dates are local `YYYY-MM-DD` strings via date-fns — never `new Date('2026-09-12')` (parses as UTC → off-by-one day).

## 13. Testing

| Target | Tests |
|---|---|
| `units` | conversion table, bridges, formatting/fractions |
| `stock` | FIFO order, expiry cutoffs, loose items, multi-meal shortfall attribution |
| `shopping` | prior-meal consumption, restock, pack rounding, overrides |
| `cook`/`trip` services | fake-indexeddb: deduction, "pantry was off", undo restores lots exactly |
| `forecast` | rate with sparse data, threshold fallback, status priority |
| `autoplan` | seeded determinism, filters never violated |
| Seed data | every ingredientId exists, every unit converts, tags valid |
| E2E (later) | Playwright WebKit @ iPhone 15: plan → shop → finish trip → cook → pantry updated |

## 14. Phase 1 build order

1. Scaffold (Vite, Tailwind, PWA plugin, router, tab layout)
2. `domain/units`, `domain/stock`, `domain/packages` + tests
3. Dexie schema + seed catalog + recipes
4. Recipes browse + detail (scaler)
5. Plan screen (manual)
6. `domain/shopping` + Shopping screen (checks, share)
7. Pantry screen (lots, quick add, adjust)
8. Cook + finish-trip services with undo
9. Home with basic alerts → deploy → install on iPhone

**Defaults chosen** (easy to change): loose tracking for spices/oils; shopping list computed live, not stored; waste excluded from usage rates; greedy auto-plan (not a global optimizer).
