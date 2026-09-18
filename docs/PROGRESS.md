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

## Session: serving-size scaling, smoker, sides and a bigger recipe book (2026-09-18)
- Instructions scale with servings: step text amounts are rewritten from the scaled ingredient lines, so a 1-can batch of pinto bean soup no longer says "3 cans". The recipe unit toggle (US/metric) and per-line amount cycling apply inside steps too.
- Scale to one ingredient: pick any ingredient line and set the amount you actually want to use (1 can of beans, 1 lb of ground turkey) and the whole recipe, including servings and step text, scales to it.
- Temperatures convert like measurements: oven and internal temps cycle F/C with the same tap, following the recipe-level unit setting.
- Auto-plan availability: picking is weighted by how much of each recipe is already on hand relative to a threshold, so a pantry holding only rice no longer returns only rice. Individual meals can be kept and the rest re-planned.
- Shopping list items link out to a Walmart search for that item (opens the app when installed).
- Stock check (`/stock-check`, Settings -> Stock check): walks every ingredient any recipe calls for, one at a time, asking for on-hand info. Skip sends the item to the back of the queue; "Don't track" sets `alwaysOnHand`.
- Search ranks whole-phrase matches first, so "honey chicken" surfaces honey chicken before other chicken dishes.
- Smoker recipes are tagged `smoker` and configurable in Settings: include in auto-plan or not, weekends only, and whether to confirm before a smoker meal is planned.
- Sides: `role: 'side'` recipes are excluded from the entree slot and are the pool for the side slot; auto-plan gives an entree plus at least one side that suits it (`pairsWith`, then cuisine, then availability). 37 existing standalone dishes were re-tagged as sides, plus new dedicated side recipes.
- Ingredient names always use the American term (corn starch, not cornflour); UK names are kept as aliases so search still finds them.
- New recipes: smoker (Hey Grill Hey), African and Caribbean (jollof, chicken yassa, doro wat, peanut stew, tagine, Jamaican curry chicken), global mains (oyakodon, nasi goreng, dak bulgogi, chicken tinola, tavuk sis), and more desserts. No fish (canned tuna is fine); ground turkey replaces ground beef where it works. Every built-in recipe still credits a named human source with a verified link.
- Later recipe batches (more cultural variety, more sides, more desserts): pho ga, arroz con gandules, Japanese chicken curry, aji de gallina, Trini curry channa and aloo, chicken korma, menemen, spanakopita, West African okra stew, muamba de galinha; sides sukuma wiki, roasted asparagus, refried beans, tabbouleh, zaalouk, fattoush; desserts tres leches cake and puff puff; smoker 3-2-1 ribs and smoked queso.
- Still later batches: Sri Lankan chicken curry, ajiaco bogotano, semur ayam, chicken afritada, shkmeruli, kari ayam, red red, East African chicken pilau, Shan noodles; sides aloo gobi, ful mudammas, calabacitas, garlic baby bok choy, smashed cucumber salad, kachumbari, Greek lemon potatoes; dessert brigadeiros.
- Final batches: chicken karaage, jjimdak, suqaar digaag, peri peri chicken, chicken chettinad, kabuli pulao, caldo verde, Cuban arroz con pollo, fesenjan, maqluba, dakdoritang;
  sides sigeumchi namul, cucumber raita, Mexican rice, patatas bravas, sunomono, quick pickled red onions, jeera rice; desserts malva pudding, mango sticky rice.
- New catalog ingredients: chili oil, apricot jam, shredded coconut, glutinous rice, pomegranate molasses.
- More batches: cheese grits, roasted okra, Moroccan couscous pilaf, spaetzle, curtido sides; pupusas, bun cha and Swedish meatballs (turkey + pork).
- New catalog ingredients: grits, masa harina.
- Later batches: khao soi, jambalaya, chicken laksa, Uzbek chicken plov, kuku paka, Cape Malay chicken curry,
  chicken rendang and okonomiyaki mains; naan and succotash sides; basbousa and gulab jamun desserts;
  smoked pork tenderloin and smoked spatchcock chicken.
- New catalog ingredients: semolina, milk powder, lima beans, whole chicken, galangal, makrut lime leaves.
- Hainanese chicken rice and sinigang na baboy added; daikon added to the catalog.
- Adjaruli khachapuri and bigos added; sauerkraut, prunes, dry red wine added to the catalog.
- Mizeria side and lemon bars dessert added.
- Lumpia shanghai and chicken momo added; ground chicken, spring roll and wonton wrappers added to the catalog.
- Ghanaian waakye and Ethiopian chicken tibs added.
- Trinidad doubles and chicken mole added.
- Jamaican rice and peas and garlic mashed potatoes sides added.
- Smoker: pork belly burnt ends and smoked turkey legs; pork belly and turkey legs added to the catalog.
- Massaman chicken curry added; massaman curry paste added to the catalog.
- Dakgalbi and sarmale added (Korean and Romanian).
- Kedjenou (Ivorian) and colcannon side added.
- Alfajores dessert added; dulce de leche added to the catalog.
- Falafel and sundubu jjigae added; dry chickpeas added to the catalog.
- Tonkatsu and Argentinian chicken empanadas added.
- Smoked jalapeno poppers and Southern collard greens side added.
- Dal makhani and Louisiana red beans and rice added; black lentils and dry kidney beans added to the catalog.
- Chicken and sausage gumbo and Basque burnt cheesecake added.
- Chicken paella and shopska salad side added.
- Ugandan rolex and Zimbabwean sadza side added.
- Czech roast pork with sauerkraut and Czech bread dumplings side added.
- Haitian poul nan sos and Viennese apple strudel added.
- SEED_VERSION 134.
- Later in the same session: more world mains (arepas de queso, tteokbokki, chicken katsu, chicken congee, pancit bihon, borscht, moussaka with ground turkey, japchae, mapo tofu, palak paneer, chicken biryani, pozole verde, vegetarian shepherd's pie, misir wat), more desserts (no-bake cheesecake, churros, tiramisu, baklava, carrot cake, bread pudding, cut-out sugar cookies, panna cotta) and ten more sides (gomen, cilantro lime rice, cumin lime coleslaw, roasted cauliflower, street corn salad, roasted brussels sprouts, glazed carrots, braised red cabbage, creamed corn, macaroni salad).
- Bundle: the recipe catalog and ingredient catalog are now dynamic imports inside `seedIfNeeded`, and the six screens you only reach by navigating (cook mode, recipe editor, settings, stock check, prep, pantry item) are `React.lazy` behind a `Suspense` fallback. Launch JS went from 1,953 kB (545 kB gzip) to ~735 kB (229 kB gzip).

## Known gaps / ideas for next session
- Notifications only fire while the app is open (iOS web app limit). Calendar export covers timed reminders.
- The auto-backup copy lives in the same site storage iOS may evict; it protects against DB corruption/partial loss, not against deleting the app.
- No UI tests yet (only domain/services). Consider Playwright smoke tests.
- Hosting: any static host works (`base: './'` + HashRouter). Must be HTTPS for install/offline on iPhone.

## Next steps
1. Deploy (GitHub Pages / Netlify / Cloudflare Pages) and install on iPhone via Safari → Share → Add to Home Screen.
2. Items under "Known gaps".
