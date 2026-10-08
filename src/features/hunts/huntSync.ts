import { allHunts, getPhoto, saveCreature, saveHunt, setSetting } from '../../lib/db/database';
import { blobToDataUrl, fieldApi, type Pairing } from '../../lib/home/client';
import { applyVerdict } from './huntService';
import type { Hunt } from './huntSchemas';

/** Field mode: park the finished hunt on the phone. Uploading happens in `syncHunts`. */
export async function submitHunt(hunt: Hunt): Promise<Hunt> {
  const queued: Hunt = { ...hunt, status: 'queued', seen: false };
  await saveHunt(queued);
  await setSetting('activeHuntId', null);
  return queued;
}

/**
 * Sends queued hunts home, then picks up any that Gemma has checked. Same deal as
 * `syncFinds`: no signal means the upload throws and the hunt stays queued.
 */
export async function syncHunts(pairing: Pairing): Promise<boolean> {
  const api = fieldApi(pairing);
  const hunts = await allHunts();
  let changed = false;

  for (const hunt of hunts.filter((h) => h.status === 'queued')) {
    const items = [];
    for (const item of hunt.items) {
      const photo = item.photoId ? await getPhoto(item.photoId) : undefined;
      if (photo) items.push({ id: item.id, text: item.text, photo: await blobToDataUrl(photo.blob) });
    }
    await api.uploadHunt({ id: hunt.id, title: hunt.title, createdAt: hunt.createdAt, items });
    hunt.status = 'waiting';
    await saveHunt(hunt);
    changed = true;
  }

  const waiting = hunts.filter((h) => h.status === 'waiting');
  if (!waiting.length) return changed;
  const results = (await api.hunts(waiting.map((h) => h.id))) ?? [];

  for (const remote of results) {
    const hunt = waiting.find((h) => h.id === remote.id);
    if (!hunt || remote.status !== 'done' || !remote.result) continue;
    const { creature, pickedItemId } = remote.result;
    if (creature) {
      // The phone already has this photo from the hunt, so point the creature at it.
      const photoId = hunt.items.find((i) => i.id === pickedItemId)?.photoId;
      await saveCreature({ ...creature, photoId });
    }
    await saveHunt({ ...applyVerdict(hunt, remote.result), seen: false });
    changed = true;
  }
  return changed;
}

export async function markHuntSeen(hunt: Hunt): Promise<void> {
  await saveHunt({ ...hunt, seen: true });
}
