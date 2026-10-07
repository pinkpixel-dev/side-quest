import { newId } from '../../lib/random';
import { recentCreatureTraits, saveCreature, saveQuest, setSetting } from '../../lib/db/database';
import type { Quest } from '../quests/questSchemas';
import type { Creature, Judgement, Palette, Rarity } from './creatureSchemas';
import { avoidRepeat, localCreature, rollLook } from './hatch';

export interface HatchInput {
  quest: Quest;
  photo: Blob;
  seed: number;
  rarity: Rarity;
  palette: Palette;
  judgement: Judgement;
  /** Field finds hatch on the laptop: don't touch the laptop's own quest state. */
  closeQuest?: boolean;
}

/** Builds the creature (Gemma's traits, or the local generator if they were unusable), saves it, closes the quest. */
export async function hatchCreature({ quest, photo, seed, rarity, palette, judgement, closeQuest = true }: HatchInput): Promise<Creature> {
  const traits = avoidRepeat(
    judgement.creature ?? localCreature(seed, judgement.observations),
    await recentCreatureTraits(),
    seed,
  );
  const photoId = newId();
  const creature: Creature = {
    ...traits,
    id: newId(),
    rarity,
    palette,
    seed,
    ...rollLook(seed),
    questId: quest.id,
    questTitle: quest.title,
    observations: judgement.observations,
    photoId,
    generatedLocally: !judgement.creature,
    discoveredAt: Date.now(),
  };
  await saveCreature(creature, { id: photoId, blob: photo, createdAt: creature.discoveredAt });
  if (closeQuest) {
    await saveQuest({ ...quest, status: 'completed' });
    await setSetting('activeQuestId', null);
  }
  return creature;
}
