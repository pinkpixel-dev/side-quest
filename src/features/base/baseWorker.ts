import type { GemmaClient } from '../../lib/gemma/client';
import type { baseApi } from '../../lib/home/client';
import type { Find, FindResult } from '../../lib/home/protocol';
import { hatchCreature } from '../creatures/creatureService';
import { judgePhoto } from '../proof/judgeService';
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

/** Writes one quest ahead of time so the phone has fresh ones even with no signal later. */
export async function writeQuestForPhone(gemma: GemmaClient, api: BaseApi, recentTitles: string[]): Promise<string | null> {
  const draft = await writeQuest(gemma, recentTitles).catch(() => null);
  if (!draft) return null;
  await api.addQuest(draft);
  return draft.title;
}
