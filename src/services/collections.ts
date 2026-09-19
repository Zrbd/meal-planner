// Collections live in one kv row; every change is a single transaction.
import { parseCollections, pruneCollections, toggleMembership, type Collection } from '../domain/collections';
import { db } from '../db/schema';
import { newId } from './ids';

const KEY = 'collections';

async function read(): Promise<Collection[]> {
  return parseCollections((await db.kv.get(KEY))?.value);
}

async function write(list: Collection[]): Promise<void> {
  await db.kv.put({ key: KEY, value: list });
}

export async function createCollection(name: string, emoji?: string, recipeIds: string[] = []): Promise<string> {
  const id = newId();
  const now = Date.now();
  await db.transaction('rw', db.kv, async () => {
    const list = await read();
    await write([...list, { id, name: name.trim() || 'Untitled', emoji, recipeIds, createdAt: now, updatedAt: now }]);
  });
  return id;
}

export async function renameCollection(id: string, name: string, emoji?: string): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const list = await read();
    await write(list.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name, emoji, updatedAt: Date.now() } : c)));
  });
}

export async function deleteCollection(id: string): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await write((await read()).filter((c) => c.id !== id));
  });
}

export async function toggleInCollection(collectionId: string, recipeId: string): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await write(toggleMembership(await read(), collectionId, recipeId, Date.now()));
  });
}

/** Housekeeping after recipes are deleted. */
export async function pruneCollectionsToRecipes(): Promise<void> {
  await db.transaction('rw', db.kv, db.recipes, async () => {
    const live = new Set(await db.recipes.toCollection().primaryKeys());
    await write(pruneCollections(await read(), live));
  });
}
