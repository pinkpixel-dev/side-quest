import { describe, expect, it } from 'vitest';
import { FALLBACK_QUESTS } from '../src/features/quests/fallbackQuests';
import { isPlain, isSafeQuest, questDraftSchema } from '../src/features/quests/questSchemas';
import { isTooSimilar, libraryQuest, pickCategory } from '../src/features/quests/questService';
import { animalIdea, questPrompt } from '../src/features/quests/questPrompts';
import type { QuestContext } from '../src/features/quests/questContext';
import { judgementSchema } from '../src/features/creatures/creatureSchemas';
import { avoidRepeat, localCreature, paletteFromPixels, rollLook, rollRarity } from '../src/features/creatures/hatch';
import { judgePrompt } from '../src/features/proof/judgePrompts';
import { parseStructured } from '../src/lib/ai/structured';
import { seededRandom } from '../src/lib/random';

describe('quests', () => {
  it('ships 36 valid, safe library quests with unique titles', () => {
    expect(FALLBACK_QUESTS).toHaveLength(36);
    for (const q of FALLBACK_QUESTS) {
      expect(questDraftSchema.safeParse(q).success, q.title).toBe(true);
      expect(isSafeQuest(q), q.title).toBe(true);
    }
    expect(new Set(FALLBACK_QUESTS.map((q) => q.title)).size).toBe(36);
  });

  it('rejects unsafe generated quests', () => {
    const unsafe = [
      'Climb the tallest tree you can find.',
      'Cross the street and find a red door.',
      'Wade into a creek and find a smooth stone.',
      'Taste a wild berry and describe it.',
      'Ask a stranger for their favorite plant.',
      'Pet a squirrel in the park.',
      'Explore an abandoned building.',
      'Pick five flowers for a bouquet.',
    ];
    for (const description of unsafe) expect(isSafeQuest({ title: 'Quest', description }), description).toBe(false);
  });

  it('coerces sloppy model fields instead of failing', () => {
    const parsed = questDraftSchema.parse({
      title: 'Leaf Party',
      description: 'Find a leaf bigger than your hand.',
      category: 'botany',
      difficulty: 'hard',
      estimatedMinutes: '12',
      validationHint: 'A large leaf in frame.',
    });
    expect(parsed).toMatchObject({ category: 'observation', difficulty: 'easy', estimatedMinutes: 12 });
  });

  it('avoids recently played library quests', () => {
    const recent = FALLBACK_QUESTS.slice(1).map((q) => q.title);
    expect(libraryQuest(recent).title).toBe(FALLBACK_QUESTS[0].title);
  });

  const city: QuestContext = { setting: 'city', weather: 'cloudy', season: 'autumn', time: 'afternoon' };

  it('picks library quests that suit the setting and time', () => {
    const byTitle = new Map(FALLBACK_QUESTS.map((q) => [q.title, q]));
    for (let i = 0; i < 200; i++) {
      const day = byTitle.get(libraryQuest([], city).title)!;
      expect(day.night ?? false).toBe(false);
      expect(day.wild ?? false).toBe(false);
      expect(byTitle.get(libraryQuest([], { ...city, time: 'night' }).title)!.night).toBe(true);
    }
    expect(libraryQuest([], city)).not.toHaveProperty('wild');
  });

  it('never repeats any of the last three categories', () => {
    const recent = [{ category: 'nature' }, { category: 'color' }, { category: 'texture' }] as const;
    for (let i = 0; i < 100; i++) expect(['nature', 'color', 'texture']).not.toContain(pickCategory([...recent]));
  });

  it('spots a reworded repeat but lets a new idea through', () => {
    const recent = [{ title: 'Nature Wins', description: 'Find somewhere a plant is growing through something humans built.' }];
    expect(isTooSimilar({ title: 'Concrete Rebel', description: 'Find a plant growing through something that humans built.' }, recent)).toBe(true);
    expect(isTooSimilar({ title: 'Puddle Sky', description: 'Find a puddle reflecting the clouds overhead.' }, recent)).toBe(false);
    expect(isTooSimilar({ title: 'nature wins', description: 'Totally different words here.' }, recent)).toBe(true);
  });

  it('gives Gemma the context, recent quests, and an idea to build on', () => {
    const prompt = questPrompt('color', [{ title: 'Moss Hunt', description: 'Find moss.' }], 'reflections', { ...city, time: 'night' });
    expect(prompt).toContain('a city');
    expect(prompt).toContain('It is dark out');
    expect(prompt).toContain('- Moss Hunt: Find moss.');
    expect(prompt).toContain('this idea: reflections');
    expect(prompt).not.toContain('"wild"');
  });

  it('picks animal ideas that suit the setting, season, and time', () => {
    const ideas = (ctx: QuestContext) => new Set(Array.from({ length: 300 }, () => animalIdea(ctx)));
    const winterBeach = ideas({ setting: 'beach', weather: 'sunny', season: 'winter', time: 'afternoon' });
    expect(winterBeach).toContain('gulls or shorebirds');
    for (const idea of winterBeach) expect(idea).not.toMatch(/squirrel|bee|ants|pigeons|farm|lizard|crab/);
    const desert = ideas({ setting: 'desert', weather: 'hot', season: 'summer', time: 'afternoon' });
    expect(desert).toContain('a lizard or beetle sunning itself');
    expect(desert).not.toContain('gulls or shorebirds');
    const night = ideas({ ...city, time: 'night', season: 'summer' });
    expect([...night].sort()).toEqual(['a spider web lit up by a lamp', 'moths or bugs drawn to a porch light']);
    expect(animalIdea({ ...city, time: 'night', season: 'winter' })).toBe('a spider web lit up by a lamp');
    expect(ideas(city)).not.toContain('animal tracks pressed into snow, mud, or sand');
  });

  it('tells Gemma where in the world the player is, only when they said', () => {
    expect(questPrompt('nature', [], 'a rock or stone', { ...city, place: 'Honolulu, Hawaii' })).toContain('in or near Honolulu, Hawaii');
    expect(questPrompt('nature', [], 'a rock or stone', city)).not.toContain('in or near');
  });

  it('rejects poetic quests and keeps every library quest plain', () => {
    expect(isPlain({ title: 'Breeze Hunt', description: 'Capture the outline of a cool breeze.' })).toBe(false);
    expect(isPlain({ title: 'Shell Spotter', description: 'Find a shell with stripes on it.' })).toBe(true);
    for (const q of FALLBACK_QUESTS) expect(isPlain(q), q.title).toBe(true);
  });

  it('tells Gemma to accept signs of an animal on wildlife quests only', () => {
    expect(questPrompt('wildlife', [], 'a squirrel', city)).toContain('or a clear sign of it');
    expect(questPrompt('color', [], 'shadows', city)).not.toContain('or a clear sign of it');
  });

  it('allows night quests but not dark, lonely places', () => {
    expect(isSafeQuest({ title: 'Moon Check', description: 'Find the moon at night from your porch.' })).toBe(true);
    expect(isSafeQuest({ title: 'Dark Walk', description: 'Find an unlit path and follow it.' })).toBe(false);
  });
});

describe('judgement parsing', () => {
  const output = `\`\`\`json
{"passed": "true", "confidence": "very high", "reason": "Fern by concrete.",
 "observations": ["Fern foliage", "Concrete border"],
 "creature": {"name": "Rootlet", "species": "Concrete Sprout", "description": "Loves damp concrete edges.",
   "body": "sprout", "eyeStyle": "googly", "accessory": "leaf"}}
\`\`\``;

  it('parses fenced output and falls back on bad enum values', () => {
    const j = parseStructured(output, judgementSchema);
    expect(j).not.toBeNull();
    expect(j!.passed).toBe(true);
    expect(j!.confidence).toBe('medium');
    expect(j!.creature).toMatchObject({ name: 'Rootlet', eyeStyle: 'dot', body: 'sprout' });
  });

  it('drops an unusable creature but keeps the verdict', () => {
    const j = parseStructured('{"passed": true, "observations": ["moss"], "creature": {"name": ""}}', judgementSchema);
    expect(j).toMatchObject({ passed: true, creature: null, observations: ['moss'] });
  });

  it('returns null when there is no verdict', () => {
    expect(parseStructured('{"reason": "nice photo"}', judgementSchema)).toBeNull();
  });
});

describe('creatures', () => {
  it('local creatures are deterministic and match the scene', () => {
    const a = localCreature(1234, ['brown mushroom', 'wet log']);
    expect(localCreature(1234, ['brown mushroom', 'wet log'])).toEqual(a);
    expect(a.accessory).toBe('mushroom');
  });

  it('rarity lands near 70 / 25 / 5', () => {
    const counts = { common: 0, uncommon: 0, rare: 0 };
    const rand = seededRandom(42);
    for (let i = 0; i < 20000; i++) counts[rollRarity(Math.floor(rand() * 2 ** 32))]++;
    expect(counts.common / 20000).toBeCloseTo(0.7, 1);
    expect(counts.uncommon / 20000).toBeCloseTo(0.25, 1);
    expect(counts.rare / 20000).toBeCloseTo(0.05, 1);
  });

  it('builds a palette from the dominant photo color', () => {
    // Mostly green pixels with a few red ones.
    const px = new Uint8ClampedArray(100 * 4);
    for (let i = 0; i < 100; i++) px.set(i < 85 ? [60, 150, 60, 255] : [200, 40, 40, 255], i * 4);
    const palette = paletteFromPixels(px, 7);
    const hue = (c: string) => Number(c.match(/hsl\((\d+)/)![1]);
    expect(hue(palette.primary)).toBeGreaterThan(90);
    expect(hue(palette.primary)).toBeLessThan(150);
    expect(hue(palette.accent)).toBeLessThan(20);
  });

  it('nudges the hue per seed so the same photo colors give different creatures', () => {
    const px = new Uint8ClampedArray(100 * 4);
    for (let i = 0; i < 100; i++) px.set([60, 150, 60, 255], i * 4);
    const primaries = new Set(Array.from({ length: 12 }, (_, seed) => paletteFromPixels(px, seed).primary));
    expect(primaries.size).toBeGreaterThan(6);
  });

  it('rolls every pattern and extra, deterministically', () => {
    expect(rollLook(321)).toEqual(rollLook(321));
    const looks = Array.from({ length: 400 }, (_, seed) => rollLook(seed));
    expect(new Set(looks.map((l) => l.pattern)).size).toBe(5);
    expect(new Set(looks.map((l) => l.extra)).size).toBe(4);
  });

  it('swaps the body when Gemma repeats a recent creature exactly', () => {
    const traits = { body: 'blob', eyeStyle: 'dot', accessory: 'leaf' } as const;
    expect(avoidRepeat(traits, [{ ...traits, accessory: 'none' }], 5)).toEqual(traits);
    const swapped = avoidRepeat(traits, [traits], 5);
    expect(swapped.body).not.toBe('blob');
    expect(swapped.eyeStyle).toBe('dot');
  });

  it('tells Gemma which combinations to avoid', () => {
    const quest = { title: 'Moss', description: 'Find moss.', validationHint: 'moss' };
    expect(judgePrompt(quest, 'common')).not.toContain('Recent creatures');
    expect(judgePrompt(quest, 'common', [{ body: 'blob', eyeStyle: 'dot', accessory: 'leaf' }])).toContain('blob/dot/leaf');
  });

  it('still makes a palette from a blank image', () => {
    const palette = paletteFromPixels(new Uint8ClampedArray(0), 99);
    expect(palette.primary).toMatch(/^hsl\(/);
  });
});
