# Meal Planner — Product Plan

> Saved from the planning conversation (2026-09-12). This is the "what & why".
> The "how" lives in [TECHNICAL_PLAN.md](TECHNICAL_PLAN.md). Build status lives in [PROGRESS.md](PROGRESS.md).

## 1. Platform decision: Progressive Web App (PWA)

Native iOS requires a Mac to build and a $99/yr Apple Developer account to sideload/keep on a phone. The owner is on Windows, so the app is a **PWA installed from Safari → Share → Add to Home Screen**. It:
- Gets its own icon, launches full-screen, no browser bar
- **Works offline** (grocery store with bad signal)
- Stores data **on the phone** (IndexedDB) — no account or server needed
- Hosts free (GitHub Pages / Netlify), updates automatically
- Can later be wrapped with **Capacitor** for the App Store with the same code

Stack: React + TypeScript + Vite, Tailwind, Dexie (IndexedDB), vite-plugin-pwa (offline), Vitest.

## 2. Screens (bottom tab bar, 5 tabs)

| Tab | What it does |
|---|---|
| **Home** | Tonight's meal, this week at a glance, alerts ("Low: eggs", "Spinach expires in 2 days"), "Cook tonight" |
| **Recipes** | Browse/search/filter (tags, time, diet), **"What can I make now?"** (ranks by % of ingredients you have), recipe detail with serving scaler, add/edit your own |
| **Plan** | Pick # of meals this week → **Auto-fill** or hand-pick; swap, set servings per meal, mark leftovers |
| **Shopping** | Choose range: **whole week / next 2–3 days / custom**. Grouped by store aisle, check-off, add manual items, share to Notes/Messages, **"Finish trip" → adds purchases to pantry** |
| **Pantry** | Inventory by Fridge/Freezer/Pantry, quantity bars, low/expiring badges, quick actions (+/−, "used some", "ran out", "tossed"), usage history |

**Settings:** household size, diet & disliked ingredients, US/metric, shopping day, aisle order, backup export/import.

## 3. How ingredient tracking works

1. **Ingredient catalog** (~200 common items), each with: store aisle, shelf life, **package sizes** (chicken sold in 1.5 lb packs, sour cream in 16 oz tubs), and **unit conversions** (1 cup flour = 120 g, 1 onion ≈ 150 g).
2. **Everything normalized to a base unit** (grams / ml / count) so "2 tbsp butter" in a recipe and "1 stick" in the pantry subtract correctly.
3. **Pantry lots** — each purchase is a lot with a buy date and expiry; oldest/soonest-expiring used first.
4. **Usage log** — every change recorded (bought, cooked recipe X, adjusted, tossed). Powers forecasting.

## 4. Key smart logic

**Shopping list for a date range**
1. Sum ingredients for every planned meal in the range, scaled to servings
2. Walk meals in date order, reserving pantry stock ("you have 4 eggs, Tuesday uses 3, so Thursday is short 2")
3. Subtract what you have → add staples below their low level (salt, oil, rice)
4. **Round up to real package sizes** and show leftovers ("you'll have 12 oz sour cream left → recipes that use it")
5. Each item shows which recipes need it

**Cooking a meal** — "Mark cooked" → quick review screen (adjust actual amounts) → deducts from pantry + logs it.

**Low-stock detection** — three signals:
- Fixed threshold (user-set or automatic)
- **Plan-aware:** on-hand < what upcoming meals need
- **Usage-rate forecast:** "olive oil runs out in ~6 days" based on actual consumption

**Auto-plan (HelloFresh-style)** — picks N meals scoring recipes on:
- Uses what you already have, especially **expiring items**
- **Ingredient overlap** with the other picks (so half a bunch of cilantro doesn't go to waste)
- Variety (no same protein twice in a row, not cooked recently)
- Favorites/ratings, time limits (weeknights ≤ 30 min)

## 5. Starter content

- **Starter library of original, home-cook-style recipes** (20–40 min, step-by-step, tagged by cuisine/protein/diet/difficulty). Not copied from HelloFresh.
- **Cook mode:** big text step-by-step, built-in timers, screen stays awake.
- **Easy recipe entry:** a simple form plus "paste recipe text" import that fills in the form.

## 6. Build phases

| Phase | Includes |
|---|---|
| **1 — Core loop** | Project setup, database, ingredient catalog + unit conversion, seed recipes, browse, weekly plan, shopping list by date range, pantry basics, mark-cooked deducts, deploy + install on iPhone |
| **2 — Smart** | Finish-trip → pantry, low-stock & forecasts, expiry alerts, auto-plan, "what can I make", cook mode |
| **3 — Polish** | Add/edit recipes, paste-text recipe import, leftovers, nutrition, backup export/import, pack-size waste insights |
| **4 — Optional** | Cloud sync / partner sharing (Supabase), barcode scanning, AI recipe import, App Store wrap |

**iPhone limitations to know:** true push notifications need a server, so alerts are in-app. iOS can clear site data for unused sites — installing to the Home Screen prevents that, plus one-tap backup as a safety net.

## 7. Open questions for the owner (not blocking)

1. GitHub account? (free; used to host the app) — else Netlify.
2. Household size, dietary restrictions, dislikes? (Configurable in Settings.)
3. Cuisines / weeknight time budget / breakfast & lunch or dinners only? (Configurable in Settings.)
