# Build progress

Living handoff log. Newest notes at the top of each section.

## Status checklist (Phase 1)
- [x] Plans saved (`docs/PRODUCT_PLAN.md`, `docs/TECHNICAL_PLAN.md`)
- [x] Project scaffold (Vite, TS, Tailwind, PWA plugin, vitest)
- [x] Domain: types, dates, units, packages, stock simulator
- [x] Domain: shopping, forecast, coverage, autoplan, parse
- [x] Seed ingredient catalog (`src/data/ingredients.ts`)
- [ ] Seed recipes (`src/data/recipes/`)
- [ ] Domain tests
- [ ] DB schema, seed, backup
- [ ] Services (plan, cook, trip, pantry, recipes)
- [ ] UI shell + screens
- [ ] PWA icons, build, mobile preview
- [ ] Deploy / install on iPhone (deferred — user will set up hosting later)

## Deviations from TECHNICAL_PLAN.md
- `Recipe.steps` is `string[]`; cook-mode timers are detected from step text (`detectTimerSec`).
- `Ingredient.displayUnit` added (e.g. garlic stored in g, shown as cloves).
- `Recipe` has `createdAt`, `updatedAt`, `notes`. `LooseStock.updatedAt` added.
- No nutrition data on seed recipes.
- Weeknights = Sun–Thu (`isWeeknight`).
- react-router pinned to v7 (v8 is latest) for a known API.
- Lemons/limes are counted (`ea`); recipes say "½ lemon, juiced" rather than tbsp of juice.
- Loose items only appear on the shopping list as "buy" when marked out (or low + keepStocked); unknown/low → "double-check" section.

## Decisions
- Data access: a single `AppDataProvider` with one `useLiveQuery` loading all tables (txns limited to 60 days). Data is small; simpler than per-screen queries.
- Package rounding uses 3% tolerance so float noise doesn't buy an extra pack.

## Next steps
See unchecked items above, in order.
