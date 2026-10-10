// The player's creature collection, kept on the server so a new device can pull it down.
// Each device keeps its own copy in IndexedDB; this is only the meeting point.
import type { Creature } from '../src/features/creatures/creatureSchemas';
import type { User } from './auth';
import { HttpError, SAFE_ID, empty, json, jpegBytes, readJson, type Env } from './http';

/** What the list hands back: the recipe, and whether there's a photo to fetch. */
export interface StoredCreature {
  creature: Creature;
  hasPhoto: boolean;
}

/** Phone or laptop -> server. The photo is optional: old creatures may not have one. */
export interface CreatureUpload {
  creature: Creature;
  photo?: string;
}

/** A creature recipe is about 1 KB. Anything far past that isn't one. */
const MAX_RECIPE = 16 * 1024;

export const creaturePhotoKey = (uid: string, id: string) => `${uid}/creatures/${id}.jpg`;

export async function collectionRoutes(req: Request, env: Env, path: string, user: User): Promise<Response | null> {
  const method = req.method;

  if (path === '/api/creatures' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT creature, has_photo FROM creatures WHERE user_id = ? ORDER BY discovered_at DESC',
    )
      .bind(user.id)
      .all<{ creature: string; has_photo: number }>();
    return json(results.map((r) => ({ creature: JSON.parse(r.creature), hasPhoto: !!r.has_photo }) satisfies StoredCreature));
  }

  if (path === '/api/creatures' && method === 'POST') {
    const { creature, photo } = await readJson<CreatureUpload>(req);
    const recipe = JSON.stringify(creature ?? null);
    if (!SAFE_ID.test(creature?.id ?? '') || typeof creature.name !== 'string' || recipe.length > MAX_RECIPE) {
      throw new HttpError(400, 'Bad creature.');
    }
    const jpeg = jpegBytes(photo);
    // Photo first, so a listed photo always exists. Retries just overwrite the same bytes.
    if (jpeg) await env.PHOTOS.put(creaturePhotoKey(user.id, creature.id), jpeg, { httpMetadata: { contentType: 'image/jpeg' } });
    await env.DB.prepare(
      `INSERT INTO creatures (user_id, id, creature, has_photo, discovered_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, id) DO UPDATE SET has_photo = MAX(has_photo, excluded.has_photo)`,
    )
      .bind(user.id, creature.id, recipe, jpeg ? 1 : 0, Number(creature.discoveredAt) || Date.now())
      .run();
    return empty(201);
  }

  const m = /^\/api\/creatures\/([\w-]+)\/photo$/.exec(path);
  if (m && method === 'GET') {
    const object = await env.PHOTOS.get(creaturePhotoKey(user.id, m[1]));
    if (!object) return empty(404);
    return new Response(object.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, no-store' } });
  }
  return null;
}
