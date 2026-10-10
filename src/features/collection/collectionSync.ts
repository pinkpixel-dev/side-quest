// Signed-in only: keeps this device's collection and the account's collection in step.
// Creatures are never edited after hatching, so "has it or doesn't" is the whole sync.
import { allCreatures, getPhoto, saveCreature, type StoredPhoto } from '../../lib/db/database';
import { blobToDataUrl } from '../../lib/home/client';
import type { Creature } from '../creatures/creatureSchemas';

interface StoredCreature {
  creature: Creature;
  hasPhoto: boolean;
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { ...init, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res;
}

/**
 * Uploads creatures the account doesn't have yet (including ones from before signing in),
 * then pulls down the ones this device is missing. Returns how many were pulled.
 */
export async function syncCollection(): Promise<number> {
  const remote = (await (await call('/api/creatures')).json()) as StoredCreature[];
  const remoteIds = new Set(remote.map((r) => r.creature.id));
  const local = await allCreatures();
  const localIds = new Set(local.map((c) => c.id));

  for (const creature of local.filter((c) => !remoteIds.has(c.id))) {
    const photo = creature.photoId ? await getPhoto(creature.photoId) : undefined;
    const isJpeg = photo && (photo.blob.type === 'image/jpeg' || photo.blob.type === '');
    await call('/api/creatures', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ creature, photo: isJpeg ? await blobToDataUrl(photo.blob) : undefined }),
    });
  }

  let pulled = 0;
  for (const { creature, hasPhoto } of remote.filter((r) => !localIds.has(r.creature.id))) {
    let photo: StoredPhoto | undefined;
    if (hasPhoto) {
      const res = await fetch(`/api/creatures/${encodeURIComponent(creature.id)}/photo`);
      if (res.ok) photo = { id: creature.photoId ?? crypto.randomUUID(), blob: await res.blob(), createdAt: creature.discoveredAt };
    }
    // No photo came with it: drop the id so the detail page doesn't look for one that isn't here.
    await saveCreature({ ...creature, photoId: photo?.id }, photo);
    pulled++;
  }
  return pulled;
}
