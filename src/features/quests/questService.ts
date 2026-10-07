import type { GemmaClient } from '../../lib/gemma/client';
import { generateStructured } from '../../lib/ai/structured';
import { newId } from '../../lib/random';
import { recentQuests, saveQuest, setSetting } from '../../lib/db/database';
import { FALLBACK_QUESTS } from './fallbackQuests';
import { QUEST_SHAPE, QUEST_SYSTEM, questPrompt } from './questPrompts';
import { QUEST_CATEGORIES, isSafeQuest, questDraftSchema, type Quest, type QuestDraft } from './questSchemas';

/** A library quest the player hasn't seen recently. */
export function libraryQuest(recentTitles: string[]): QuestDraft {
  const fresh = FALLBACK_QUESTS.filter((q) => !recentTitles.includes(q.title));
  const pool = fresh.length ? fresh : FALLBACK_QUESTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function gemmaQuest(gemma: GemmaClient, recentTitles: string[]): Promise<QuestDraft | null> {
  const category = QUEST_CATEGORIES[Math.floor(Math.random() * QUEST_CATEGORIES.length)];
  const draft = await generateStructured(
    gemma,
    { system: QUEST_SYSTEM, prompt: questPrompt(category, recentTitles.slice(0, 8)), maxTokens: 160, sample: true },
    { schema: questDraftSchema, shape: QUEST_SHAPE },
  );
  if (!draft || !isSafeQuest(draft) || recentTitles.includes(draft.title)) return null;
  return draft;
}

/**
 * Makes the next quest and marks it active. Uses Gemma when it's ready, otherwise (or
 * if Gemma's quest fails validation or the safety filter) a hand-written one.
 */
export async function startNewQuest(gemma: GemmaClient | null, previous?: Quest): Promise<Quest> {
  if (previous?.status === 'active') await saveQuest({ ...previous, status: 'abandoned' });
  const recentTitles = (await recentQuests()).map((q) => q.title);

  let draft: QuestDraft | null = null;
  if (gemma?.state.status === 'ready') {
    draft = await gemmaQuest(gemma, recentTitles).catch(() => null);
  }
  const source = draft ? 'gemma' : 'library';
  draft ??= libraryQuest(recentTitles);

  const quest: Quest = { ...draft, id: newId(), source, status: 'active', createdAt: Date.now() };
  await saveQuest(quest);
  await setSetting('activeQuestId', quest.id);
  return quest;
}
