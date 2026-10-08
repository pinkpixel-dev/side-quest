import type { GemmaClient } from '../../lib/gemma/client';
import type { baseApi } from '../../lib/home/client';
import { getSetting, setSetting } from '../../lib/db/database';
import type { Find, FindResult, HuntResult, HuntSubmission } from '../../lib/home/protocol';
import { judgeHunt, writeHunt } from '../hunts/huntService';
import { hatchCreature } from '../creatures/creatureService';
import { judgePhoto } from '../proof/judgeService';
import type { QuestContext } from '../quests/questContext';
import type { QuestDraft } from '../quests/questSchemas';
import { writeQuest } from '../quests/questService';

type BaseApi = ReturnType<typeof baseApi>;

/** Judges one find from the phone and reports back. The creature also joins this computer's collection. */
export async function processFind(gemma: GemmaClient, api: BaseApi, find: Find): Promise<FindResult> {
  let result: FindResult;
  try {
    const photo = await api.photo(find.id);
    const { judgement, seed, rarity, palette } = await judgePhoto(gemma, find.quest, photo);
    if (!judgement) result = { status: 'confused' };
    else if (!judgement.passed) result = { status: 'not-quite', reason: judgement.reason };
    else {
      const creature = await hatchCreature({ quest: find.quest, photo, seed, rarity, palette, judgement, closeQuest: false });
      result = { status: 'hatched', creature };
    }
  } catch (err) {
    console.error('Home base could not judge find', find.id, err);
    result = { status: 'confused' };
  }
  await api.resolve(find.id, result);
  return result;
}

/**
 * Writes one quest ahead of time so the phone has fresh ones even with no signal later.
 * Remembers what it wrote, since the phone's own history never comes back to this computer.
 */
export async function writeQuestForPhone(gemma: GemmaClient, api: BaseApi, context: QuestContext | null): Promise<string | null> {
  const history = (await getSetting<QuestDraft[]>('phoneQuestHistory')) ?? [];
  const draft = await writeQuest(gemma, history, context).catch(() => null);
  if (!draft) return null;
  await api.addQuest(draft, context);
  await setSetting('phoneQuestHistory', [draft, ...history].slice(0, 12));
  return draft.title;
}

/** Checks a whole hunt from the phone. If Gemma falls over midway, the phone still gets an answer. */
export async function processHunt(gemma: GemmaClient, api: BaseApi, hunt: HuntSubmission): Promise<HuntResult> {
  let result: HuntResult;
  try {
    result = await judgeHunt(gemma, hunt, (itemId) => api.huntPhoto(hunt.id, itemId));
  } catch (err) {
    console.error('Home base could not check hunt', hunt.id, err);
    result = { items: hunt.items.map(({ id }) => ({ id, found: false, reason: 'Home base hit a snag on this one.' })) };
  }
  await api.resolveHunt(hunt.id, result);
  return result;
}

/** Writes one hunt list ahead of time so the phone gets a Gemma-written one, signal or not. */
export async function writeHuntForPhone(gemma: GemmaClient, api: BaseApi, context: QuestContext | null): Promise<string | null> {
  const draft = await writeHunt(gemma, context).catch(() => null);
  if (!draft) return null;
  await api.addHunt(draft, context);
  return draft.title;
}
