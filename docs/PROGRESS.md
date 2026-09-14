# Build progress

Living handoff log. Newest notes at the top of each section.

## Status checklist (Phase 1)
- [x] Plans saved (`docs/PRODUCT_PLAN.md`, `docs/TECHNICAL_PLAN.md`)
- [x] Project scaffold (Vite, TS, Tailwind, PWA plugin, vitest)
- [x] Domain: types, dates, units, packages, stock simulator
- [x] Domain: shopping, forecast, coverage, autoplan, parse
- [x] Seed ingredient catalog (`src/data/ingredients.ts`)
- [x] Seed recipes (`src/data/recipes/`, 640 credited, beef-free recipes incl. 3 desserts in `desserts.ts`)
- [x] Domain + service tests (`tests/`, 64 passing)
- [x] DB schema, seed, backup (`src/db/`)
- [x] Services (plan, cook, trip, pantry, recipes, shopping)
- [x] UI shell + screens (`src/ui/`): Today, Recipes, Recipe detail, Cook mode, Recipe editor (type or paste), Plan, Shopping, Pantry, Pantry item, Settings
- [x] PWA icons (`public/favicon.svg` → `npm run icons`), production build passes
- [x] Mobile preview smoke test (375×812): Home, Plan auto-fill, Shopping list, paste-import — no console errors
- [x] Deploy: GitHub Pages at https://zrbd.github.io/meal-planner/ (repo https://github.com/Zrbd/meal-planner, public)
  - `.github/workflows/deploy.yml` runs tests + build and publishes `dist/` on every push to `main`.
  - Pages source = "GitHub Actions" (enabled via API). gh CLI installed on the dev PC, logged in as Zrbd.
- [ ] User installs on iPhone (Safari → Share → Add to Home Screen)

## Deviations from TECHNICAL_PLAN.md
- `Recipe.steps` is `string[]`; cook-mode timers are detected from step text (`detectTimerSec`).
- `Ingredient.displayUnit` added (e.g. garlic stored in g, shown as cloves).
- `Recipe` has `createdAt`, `updatedAt`, `notes`. `LooseStock.updatedAt` added.
- No nutrition data on seed recipes.
- Weeknights = Sun–Thu (`isWeeknight`).
- react-router pinned to v7 (v8 is latest) for a known API.
- Lemons/limes are counted (`ea`); recipes say "½ lemon, juiced" rather than tbsp of juice.
- Loose items only appear on the shopping list as "buy" when marked out (or low + keepStocked); unknown/low → "double-check" section.
- Settings and `lastBackupAt` live in the `kv` table.

## Decisions
- Containers and units are data, not code: `Ingredient.unitAliases` + `packages` are user-editable (Pantry item → Units & sizes, `saveUnits` sets `unitsEdited` so reseeds keep them). Lots carry `packSize`/`opened`; using part of a sealed pack splits the rest into an opened lot with its own location/expiry (`domain/containers.ts`, `services/pantry.takeFromLot`), recorded as a delta-0 `moved` txn so undo folds it back and usage rates ignore it. Canned goods default to 4 days fridge once opened (`openedShelfLife` overrides).
- Substitutions rewrite the recipe line (`RecipeIngredient.swappedFrom` keeps the original); steps show the new name via `displayStep`, so plan, shopping, pantry and cook mode all follow.
- Prep list (`/prep`, `domain/prepweek.ts`): knife prep from `ri.prep` grouped by ingredient; a portion goes to the fridge if its cut-life covers the day it is cooked, otherwise the freezer with a thaw-the-night-before note. Checks live in kv `prepChecks`.
- Backup file name is fixed (`meal-planner-backup.json`) so the phone keeps one file.
- Data access: a single `AppDataProvider` with one `useLiveQuery` loading all tables (txns limited to 60 days). Data is small; simpler than per-screen queries.
- Package rounding uses 3% tolerance so float noise doesn't buy an extra pack.
- Recipe editor: every ingredient line must be matched to a catalog ingredient (or a new one created from the picker) so pantry/shopping math works. Units that don't convert prompt "1 {unit} = N {base}" and save to `Ingredient.unitAliases`.
- Plan auto-fill: per enabled slot, `mealsPerWeek − already planned`, spread evenly over free days ≥ today; user previews, shuffles, or removes picks before applying.
- Shopping "Done shopping" → `finishTrip` adds checked items to pantry with default expiry; undo via toast or the "last trip" link.

- No beef anywhere (user doesn't eat beef/beef broth). `tests/seed.test.ts` guards it. Every built-in recipe has `credit` (human source + link); steps are rewritten, not copied.
- Freshness (`domain/freshness.ts`): lots older than ~half their shelf life (3–7 days) with no planned meal → "Use it up?" alert and a pre-auto-fill "Use these up?" sheet (`autoPlan({ useUp })` boosts recipes that use them). Frozen lots allocated to meals in the next 2 days → thaw alerts.
- Storage tips (`data/storage.ts`: `storageTip`, `tipShelfLife`, `thawTip`) show on the recipe page ("Keep it fresh"), inline on the cook-mode step that first mentions the ingredient, on the pantry item page, and when adding stock ("I stored it this way" uses the longer shelf life).
- Units: recipe page has a per-recipe US/Metric toggle; tapping an amount cycles that one line through its options (`amountOptions`). Stored in localStorage `units:{recipeId}`; base recipe unchanged.
- Notifications: iOS web apps can't schedule local notifications. When enabled, `NotificationBridge` badges the icon and shows a digest of new alerts (deduped 2 days) each time the app opens; Settings → "Add this week's reminders to Calendar" shares an .ics with thaw/cook/use-by/shopping alarms (`domain/ics.ts`).

- Pantry: every ingredient has a food category (`domain/categories.ts`), shown as groups; spices and staples are separate tabs. Ingredients a planned meal this week uses appear in the pantry even with nothing on hand.
- Recipes: filters for cuisine, protein type and dish type (`domain/dishes.ts`: `proteinTypeOf`, `dishTypeOf`). Auto-fill dinners must be `isFullMeal` (entrée/soup/salad with ≥28 g protein per serving); sides like rice or green beans are never a dinner.
- Plan: "Quick add" (`domain/quickadd.ts`) offers only recipes fully covered by stock after earlier planned meals take their share. Each day lists the cookware its meals need (`equipmentOf`, from step text). Week cost shows in the subtitle.
- Prices: optional price per shopping line (put-away sheet or line sheet) is saved on the trip. `domain/prices.ts` derives the latest unit price → estimated line cost, recipe cost ("About $X · $Y a serving") and spending totals (7 days / month).
- Waste-free buying: `wasteHint` flags perishable package extra (shelf life ≤14 days) that no meal within its use-by would use, and suggests buying exactly what's needed loose, freezing the extra, or planning a meal for it. Put-away sheet shows use-by dates.
- Prep ahead (`domain/prep.ts`): marinate/soak/rise/chill/rest steps with ≥15 min are read from recipe text (overnight = 8 h, ranges use the low end). Cooking is assumed to start at breakfast 7:30, lunch 11:30, dinner 17:00. Home "Prep ahead" timeline lists thaw and prep with start times. Alerts: a heads-up up to 24 h before (≥30 min steps), then a "now" alert 30 min before, and thaw-now at 18:00 the night before. The .ics export includes prep events. A 2-minute clock tick re-evaluates while the app is open.
- Auto backup (`db/autobackup.ts`): every launch and every time the app is backgrounded, a compact copy (no plain built-in recipes) goes to localStorage + Cache Storage. On launch, if the DB has no user data but the copy does, it's imported and re-seeded, and Home shows a "restored" banner. "Start over" clears the copy first. Real files can't be written silently on iOS, so manual backup files are still recommended.

## Known gaps / ideas for next session
- Notifications only fire while the app is open (iOS web app limit). Calendar export covers timed reminders.
- The auto-backup copy lives in the same site storage iOS may evict; it protects against DB corruption/partial loss, not against deleting the app.
- JS bundle is ~700 kB (216 kB gzip) — could code-split screens with `React.lazy`.
- Auto-fill can put similar proteins on back-to-back days; consider a variety penalty for same protein on adjacent days in `autoplan.ts`.
- No UI tests yet (only domain/services). Consider Playwright smoke tests.
- Hosting: any static host works (`base: './'` + HashRouter). Must be HTTPS for install/offline on iPhone.

## Next steps
1. Deploy (GitHub Pages / Netlify / Cloudflare Pages) and install on iPhone via Safari → Share → Add to Home Screen.
2. Items under "Known gaps".
