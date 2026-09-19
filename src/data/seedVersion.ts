/**
 * Bump when built-in ingredients/recipes change so seeding upserts them (user-edited recipes are kept).
 *
 * Kept in its own module so the app can check the version without pulling in the (large)
 * recipe catalog: `seedIfNeeded` only imports the catalog when it actually has to seed.
 */
export const SEED_VERSION = 149;
