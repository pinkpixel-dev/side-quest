import { allFinds, saveCreature, saveFind, saveQuest, setSetting, type LocalFind } from '../../lib/db/database';
import { blobToDataUrl, fieldApi, type Pairing } from '../../lib/home/client';
import { newId } from '../../lib/random';
import type { Quest } from '../quests/questSchemas';

/** Field mode: park the photo locally and close the quest. Uploading happens in `syncFinds`. */
export async function submitFind(quest: Quest, photo: Blob): Promise<LocalFind> {
  const find: LocalFind = { id: newId(), quest, photo, createdAt: Date.now(), status: 'queued', seen: false };
  await saveFind(find);
  await saveQuest({ ...quest, status: 'submitted' });
  await setSetting('activeQuestId', null);
  return find;
}

/**
 * Sends queued photos home, then asks about ones still waiting. Safe to call any time:
 * if there's no signal, the upload throws and everything stays queued for next time.
 * Returns true when anything changed.
 */
export async function syncFinds(pairing: Pairing): Promise<boolean> {
  const api = fieldApi(pairing);
  const finds = await allFinds();
  let changed = false;

  for (const find of finds.filter((f) => f.status === 'queued')) {
    await api.upload({ id: find.id, quest: find.quest, photo: await blobToDataUrl(find.photo), createdAt: find.createdAt });
    find.status = 'waiting';
    await saveFind(find);
    changed = true;
  }

  const waiting = finds.filter((f) => f.status === 'waiting');
  if (!waiting.length) return changed;
  const results = (await api.finds(waiting.map((f) => f.id))) ?? [];

  for (const result of results) {
    const find = waiting.find((f) => f.id === result.id);
    if (!find || result.status === 'waiting') continue;
    if (result.status === 'hatched' && result.creature) {
      // Keep the phone's own copy of the photo next to the creature.
      const photoId = result.creature.photoId ?? newId();
      await saveCreature({ ...result.creature, photoId }, { id: photoId, blob: find.photo, createdAt: find.createdAt });
      await saveQuest({ ...find.quest, status: 'completed' });
      Object.assign(find, { status: 'hatched', creatureId: result.creature.id });
    } else {
      Object.assign(find, { status: result.status, reason: result.reason });
    }
    await saveFind(find);
    changed = true;
  }
  return changed;
}

export async function markSeen(find: LocalFind): Promise<void> {
  await saveFind({ ...find, seen: true });
}

/** "Not quite": put the quest back in play so the player can try another photo. */
export async function retryFind(find: LocalFind): Promise<void> {
  await markSeen(find);
  await saveQuest({ ...find.quest, status: 'active' });
  await setSetting('activeQuestId', find.quest.id);
}
