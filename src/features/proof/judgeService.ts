import type { GemmaClient } from '../../lib/gemma/client';
import { generateStructured } from '../../lib/ai/structured';
import { recentCreatureTraits } from '../../lib/db/database';
import { seedFromBlob } from '../../lib/random';
import { judgementSchema, type Judgement, type Palette, type Rarity } from '../creatures/creatureSchemas';
import { paletteFromPhoto, rollRarity } from '../creatures/hatch';
import type { Quest } from '../quests/questSchemas';
import { JUDGE_SHAPE, JUDGE_SYSTEM, judgePrompt } from './judgePrompts';

/** 140 soft tokens was plenty in the spike and keeps the image encode quick. */
export const IMAGE_BUDGET = 140;

/** Asks Gemma whether the photo fits the quest and, if so, who lives there. Null if it never made sense. */
export function judgeFind(
  gemma: GemmaClient,
  quest: Quest,
  photo: Blob,
  rarity: Rarity,
  onToken?: (chunk: string) => void,
  recent: Awaited<ReturnType<typeof recentCreatureTraits>> = [],
): Promise<Judgement | null> {
  return generateStructured(
    gemma,
    {
      system: JUDGE_SYSTEM,
      prompt: judgePrompt(quest, rarity, recent),
      image: photo,
      imageBudget: IMAGE_BUDGET,
      maxTokens: 260,
    },
    { schema: judgementSchema, shape: JUDGE_SHAPE, onToken },
  );
}

export interface JudgedPhoto {
  judgement: Judgement | null;
  seed: number;
  rarity: Rarity;
  palette: Palette;
}

/** Seed, rarity, palette and Gemma's verdict for one photo. Shared by solo mode and the home base. */
export async function judgePhoto(gemma: GemmaClient, quest: Quest, photo: Blob): Promise<JudgedPhoto> {
  const seed = await seedFromBlob(photo);
  const rarity = rollRarity(seed);
  const recent = await recentCreatureTraits();
  const [palette, judgement] = await Promise.all([
    paletteFromPhoto(photo, seed),
    judgeFind(gemma, quest, photo, rarity, undefined, recent),
  ]);
  return { judgement, seed, rarity, palette };
}
