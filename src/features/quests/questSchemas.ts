import { z } from 'zod';

export const QUEST_CATEGORIES = ['observation', 'nature', 'texture', 'color', 'pattern', 'wildlife', 'urban-nature'] as const;
export type QuestCategory = (typeof QUEST_CATEGORIES)[number];

/** What Gemma (or the library) provides. Loose fields fall back instead of failing the quest. */
export const questDraftSchema = z.object({
  title: z.string().trim().min(2).max(40),
  description: z.string().trim().min(12).max(220),
  category: z.enum(QUEST_CATEGORIES).catch('observation'),
  difficulty: z.enum(['easy', 'medium']).catch('easy'),
  estimatedMinutes: z.coerce.number().int().min(5).max(30).catch(15),
  validationHint: z.string().trim().min(8).max(220),
});
export type QuestDraft = z.infer<typeof questDraftSchema>;

export type QuestStatus = 'active' | 'completed' | 'abandoned';

export interface Quest extends QuestDraft {
  id: string;
  source: 'gemma' | 'library';
  status: QuestStatus;
  createdAt: number;
}

/**
 * Hard safety net on top of the prompt rules. Small models occasionally ignore an
 * instruction, so anything that looks like trespassing, traffic, water, climbing,
 * eating, strangers, or handling animals gets rejected outright.
 */
const UNSAFE = [
  /trespass|private property|fence (line|jump)|backyard of/i,
  /\bclimb|rooftop|\broof\b|ladder|ledge/i,
  /\b(road|street|highway|traffic|crosswalk|intersection)s?\b.*\b(cross|middle|stand|walk (in|on))\b|\bcross(ing)? the (road|street)/i,
  /\b(swim|wade|river|lake|pond|creek|stream|ocean)\b/i,
  /\b(eat|taste|lick|chew|forage)\b/i,
  /\bstranger|ask (someone|a person)|photograph (a )?(person|people)/i,
  /\b(touch|pet|pick up|catch|chase|feed) (an? |the )?(animal|bird|squirrel|insect|bug|wildlife|snake)/i,
  /abandoned|after dark|at night|midnight/i,
  /\b(pick|collect|take home|uproot|break off)\b/i,
];

export function isSafeQuest(q: Pick<QuestDraft, 'title' | 'description'>): boolean {
  const text = `${q.title} ${q.description}`;
  return !UNSAFE.some((re) => re.test(text));
}
