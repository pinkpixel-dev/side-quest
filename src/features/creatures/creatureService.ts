import { newId } from '../../lib/random';
import { saveCreature, saveQuest, setSetting } from '../../lib/db/database';
import type { Quest } from '../quests/questSchemas';
import type { Creature, Judgement, Palette, Rarity } from './creatureSchemas';
import { localCreature } from './hatch';

export interface HatchInput {
  quest: Quest;
  photo: Blob;
  seed: number;
  rarity: Rarity;
  palette: Palette;
  judgement: Judgement;
}

/** Builds the creature (Gemma's traits, or the local generator if they were unusable), saves it, closes the quest. */
export async function hatchCreature({ quest, photo, seed, rarity, palette, judgement }: HatchInput): Promise<Creature> {
  const traits = judgement.creature ?? localCreature(seed, judgement.observations);
  const photoId = newId();
  const creature: Creature = {
    ...traits,
    id: newId(),
    rarity,
    palette,
    seed,
    questId: quest.id,
    questTitle: quest.title,
    observations: judgement.observations,
    photoId,
    generatedLocally: !judgement.creature,
    discoveredAt: Date.now(),
  };
  await saveCreature(creature, { id: photoId, blob: photo, createdAt: creature.discoveredAt });
  await saveQuest({ ...quest, status: 'completed' });
  await setSetting('activeQuestId', null);
  return creature;
}
