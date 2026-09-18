# Meal Planner — agent guide

HelloFresh-style meal planner PWA for iPhone (installed via Safari → Add to Home Screen).
Recipes → weekly plan → exact shopping list → pantry tracking with low-stock forecasts.

**Read first:** `docs/PROGRESS.md` (what's done / next), then `docs/TECHNICAL_PLAN.md` and `docs/PRODUCT_PLAN.md`.
Update `docs/PROGRESS.md` whenever you finish a milestone or deviate from the plans.

## Commands
- `npm run dev` — Vite dev server (exposed on LAN via `--host`, open on phone)
- `npm test` — vitest (domain + services, fake-indexeddb)
- `npm run typecheck` — tsc
- `npm run build` — typecheck + production build to `dist/`
- `npm run icons` — regenerate PWA icons from `public/favicon.svg`

## Stack
Vite + React 19 + TypeScript, Tailwind v4, Dexie (IndexedDB) + dexie-react-hooks, react-router 7 (HashRouter),
date-fns, zod, fuse.js, lucide-react, vite-plugin-pwa. All data is local on the device; no backend.

## Architecture rules
- `src/domain/` — **pure** functions, no DB/React. All tricky logic lives here and is unit-tested.
  - `units.ts` conversions/formatting · `stock.ts` allocation simulator (core) · `shopping.ts` list builder
  - `forecast.ts` low-stock/expiry alerts · `autoplan.ts` meal picker · `coverage.ts` "can make" · `parse.ts` text import
- `src/db/` — Dexie schema, seeding, backup. The DB is the single source of truth.
- `src/services/` — the only code that writes to the DB; each action is one Dexie transaction.
- `src/data/` — built-in ingredient catalog and original recipes.
- `src/ui/` — React screens/components. Read data via `useAppData()` (one live query over all tables).
- Derived data (shopping list, alerts, coverage) is computed on render, never stored.

## Conventions
- Quantities in stock math are in the ingredient's `baseUnit` (g / ml / ea).
- Dates are local `'YYYY-MM-DD'` strings (`src/domain/dates.ts`). Never `new Date('YYYY-MM-DD')`.
- Recipe ingredients reference catalog ids; `tests/seed.test.ts` verifies every id exists and every unit converts.
- Loose-tracked items (spices, oils, condiments) use plenty/low/out instead of amounts.
- Commit messages end with `Co-Authored-By: Codex Opus 5 <noreply@anthropic.com>`.
