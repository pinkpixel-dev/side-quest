import type { GemmaClient } from '../../lib/gemma/client';
import { generateStructured } from '../../lib/ai/structured';
import { newId } from '../../lib/random';
import { recentQuests, saveQuest, setSetting } from '../../lib/db/database';
import { FALLBACK_QUESTS } from './fallbackQuests';
import type { QuestContext } from './questContext';
import { QUEST_FOCUSES, QUEST_SHAPE, QUEST_SYSTEM, animalIdea, questPrompt } from './questPrompts';
import { QUEST_CATEGORIES, isSafeQuest, questDraftSchema, type Quest, type QuestCategory, type QuestDraft } from './questSchemas';

type Recent = Pick<QuestDraft, 'title' | 'description' | 'category'>;

const anyOf = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** A library quest the player hasn't seen recently that suits where and when they are. */
export function libraryQuest(recentTitles: string[], context?: QuestContext | null): QuestDraft {
  const night = context?.time === 'night';
  const noWild = context?.setting === 'city' || context?.setting === 'open';
  const suitable = FALLBACK_QUESTS.filter((q) => !!q.night === night && !(noWild && q.wild));
  const fresh = suitable.filter((q) => !recentTitles.includes(q.title));
  const { wild: _wild, night: _night, ...draft } = anyOf(fresh.length ? fresh : suitable);
  return draft;
}

/** Any category the last three quests didn't use, so the same kind never comes up three times running. */
export function pickCategory(recent: Pick<QuestDraft, 'category'>[]): QuestCategory {
  const used = new Set(recent.slice(0, 3).map((q) => q.category));
  const open = QUEST_CATEGORIES.filter((c) => !used.has(c));
  return anyOf(open.length ? open : QUEST_CATEGORIES);
}

const STOPWORDS = new Set(
  'find something that with your from this into where have more than they them their there what when which while about some like just look looks only near most each other very'.split(
    ' ',
  ),
);

function keywords(q: Pick<QuestDraft, 'title' | 'description'>): Set<string> {
  return new Set(
    `${q.title} ${q.description}`
      .toLowerCase()
      .split(/[^a-z]+/)
      // Crude stemming so "leaves" and "leaf" or "shadows" and "shadow" count as the same idea.
      .map((w) => w.replace(/(ves|es|s)$/, ''))
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );
}

/** True when a new quest shares too much of its wording with one played recently. */
export function isTooSimilar(draft: Pick<QuestDraft, 'title' | 'description'>, recent: Pick<QuestDraft, 'title' | 'description'>[]): boolean {
  const mine = keywords(draft);
  return recent.some((q) => {
    if (q.title.toLowerCase() === draft.title.toLowerCase()) return true;
    const theirs = keywords(q);
    const shared = [...mine].filter((w) => theirs.has(w)).length;
    return shared / Math.min(mine.size, theirs.size || 1) >= 0.5;
  });
}

/**
 * Has Gemma write a fresh quest. Tries a second category and idea if the first comes back
 * too close to something recent. Null when nothing passes validation or the safety filter.
 */
export async function writeQuest(gemma: GemmaClient, recent: Recent[], context: QuestContext | null): Promise<QuestDraft | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const category = pickCategory(recent);
    const focus = category === 'wildlife' ? animalIdea(context) : anyOf(QUEST_FOCUSES);
    const draft = await generateStructured(
      gemma,
      {
        system: QUEST_SYSTEM,
        prompt: questPrompt(category, recent.slice(0, 6), focus, context),
        maxTokens: 160,
        sample: true,
      },
      { schema: questDraftSchema, shape: QUEST_SHAPE },
    );
    if (draft && isSafeQuest(draft) && !isTooSimilar(draft, recent.slice(0, 10))) return draft;
  }
  return null;
}

/** Drops the active quest without starting another, e.g. when the form has to come first. */
export async function abandonQuest(quest: Quest): Promise<void> {
  if (quest.status === 'active') await saveQuest({ ...quest, status: 'abandoned' });
  await setSetting('activeQuestId', null);
}

/**
 * Makes the next quest and marks it active. Uses Gemma when it's ready (or, in field
 * mode, a quest the home base wrote ahead of time), otherwise a hand-written one.
 */
export async function startNewQuest(
  gemma: GemmaClient | null,
  previous?: Quest,
  fromHome?: () => Promise<QuestDraft | null>,
  context: QuestContext | null = null,
): Promise<Quest> {
  if (previous?.status === 'active') await saveQuest({ ...previous, status: 'abandoned' });
  const recent = await recentQuests();
  const recentTitles = recent.map((q) => q.title);

  let draft: QuestDraft | null = null;
  if (fromHome) {
    const remote = await fromHome().catch(() => null);
    const parsed = remote ? questDraftSchema.safeParse(remote) : null;
    if (parsed?.success && isSafeQuest(parsed.data) && !recentTitles.includes(parsed.data.title)) draft = parsed.data;
  } else if (gemma?.state.status === 'ready') {
    draft = await writeQuest(gemma, recent, context).catch(() => null);
  }
  const source = draft ? 'gemma' : 'library';
  draft ??= libraryQuest(recentTitles, context);

  const quest: Quest = { ...draft, id: newId(), source, status: 'active', createdAt: Date.now() };
  await saveQuest(quest);
  await setSetting('activeQuestId', quest.id);
  return quest;
}
