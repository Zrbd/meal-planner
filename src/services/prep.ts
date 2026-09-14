import { db } from '../db/schema';

const KEY = 'prepChecks';
const MAX = 400;

/** Check or uncheck prep checklist tasks (ids are tied to planned meals, so old ones age out). */
export async function setPrepChecked(ids: string[], checked: boolean): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const cur = new Set(((await db.kv.get(KEY))?.value as string[] | undefined) ?? []);
    for (const id of ids) {
      if (checked) {
        cur.delete(id);
        cur.add(id);
      } else cur.delete(id);
    }
    await db.kv.put({ key: KEY, value: [...cur].slice(-MAX) });
  });
}
