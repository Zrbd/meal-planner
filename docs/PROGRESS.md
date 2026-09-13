# Build progress

Living handoff log. Newest notes at the top of each section.

## Status checklist (Phase 1)
- [x] Plans saved (`docs/PRODUCT_PLAN.md`, `docs/TECHNICAL_PLAN.md`)
- [x] Project scaffold (Vite, TS, Tailwind, PWA plugin, vitest)
- [x] Domain: types, dates, units, packages, stock simulator
- [x] Domain: shopping, forecast, coverage, autoplan, parse
- [x] Seed ingredient catalog (`src/data/ingredients.ts`)
- [x] Seed recipes (`src/data/recipes/`, 33 recipes)
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
- Data access: a single `AppDataProvider` with one `useLiveQuery` loading all tables (txns limited to 60 days). Data is small; simpler than per-screen queries.
- Package rounding uses 3% tolerance so float noise doesn't buy an extra pack.
- Recipe editor: every ingredient line must be matched to a catalog ingredient (or a new one created from the picker) so pantry/shopping math works. Units that don't convert prompt "1 {unit} = N {base}" and save to `Ingredient.unitAliases`.
- Plan auto-fill: per enabled slot, `mealsPerWeek − already planned`, spread evenly over free days ≥ today; user previews, shuffles, or removes picks before applying.
- Shopping "Done shopping" → `finishTrip` adds checked items to pantry with default expiry; undo via toast or the "last trip" link.

## Known gaps / ideas for next session
- JS bundle is ~700 kB (216 kB gzip) — could code-split screens with `React.lazy`.
- Auto-fill can put similar proteins on back-to-back days; consider a variety penalty for same protein on adjacent days in `autoplan.ts`.
- No UI tests yet (only domain/services). Consider Playwright smoke tests.
- Hosting: any static host works (`base: './'` + HashRouter). Must be HTTPS for install/offline on iPhone.

## Next steps
1. Deploy (GitHub Pages / Netlify / Cloudflare Pages) and install on iPhone via Safari → Share → Add to Home Screen.
2. Items under "Known gaps".
