import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  allCreatures,
  getPhoto,
  getQuest,
  getSetting,
  recentQuests,
  resetDbForTests,
} from '../src/lib/db/database';
import { startNewQuest } from '../src/features/quests/questService';
import { hatchCreature } from '../src/features/creatures/creatureService';

beforeEach(async () => {
  await resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('side-quest');
    req.onsuccess = req.onerror = () => resolve();
  });
});

describe('quest and creature persistence', () => {
  it('starts a library quest without Gemma and remembers it as active', async () => {
    const quest = await startNewQuest(null);
    expect(quest.source).toBe('library');
    expect(await getSetting('activeQuestId')).toBe(quest.id);
  });

  it('abandons the previous quest when skipping', async () => {
    const first = await startNewQuest(null);
    const second = await startNewQuest(null, first);
    expect((await getQuest(first.id))?.status).toBe('abandoned');
    expect(second.title).not.toBe(first.title);
    expect((await recentQuests()).map((q) => q.id).sort()).toEqual([first.id, second.id].sort());
  });

  it('hatching saves the creature and photo and completes the quest', async () => {
    const quest = await startNewQuest(null);
    const photo = new Blob(['jpeg bytes'], { type: 'image/jpeg' });
    const creature = await hatchCreature({
      quest,
      photo,
      seed: 99,
      rarity: 'rare',
      palette: { primary: 'hsl(100 50% 60%)', secondary: 'hsl(100 30% 84%)', accent: 'hsl(330 60% 65%)' },
      judgement: { passed: true, confidence: 'high', reason: '', observations: ['moss'], creature: null },
    });
    expect(creature.generatedLocally).toBe(true);
    expect(creature.accessory).toBe('leaf');
    expect((await allCreatures()).map((c) => c.id)).toEqual([creature.id]);
    expect((await getPhoto(creature.photoId!))?.blob.size).toBe(photo.size);
    expect((await getQuest(quest.id))?.status).toBe('completed');
    expect(await getSetting('activeQuestId')).toBeNull();
  });
});
