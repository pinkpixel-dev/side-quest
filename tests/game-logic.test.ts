import { describe, expect, it } from 'vitest';
import { FALLBACK_QUESTS } from '../src/features/quests/fallbackQuests';
import { isSafeQuest, questDraftSchema } from '../src/features/quests/questSchemas';
import { libraryQuest } from '../src/features/quests/questService';
import { judgementSchema } from '../src/features/creatures/creatureSchemas';
import { localCreature, paletteFromPixels, rollRarity } from '../src/features/creatures/hatch';
import { parseStructured } from '../src/lib/ai/structured';
import { seededRandom } from '../src/lib/random';

describe('quests', () => {
  it('ships 25 valid, safe library quests with unique titles', () => {
    expect(FALLBACK_QUESTS).toHaveLength(25);
    for (const q of FALLBACK_QUESTS) {
      expect(questDraftSchema.safeParse(q).success, q.title).toBe(true);
      expect(isSafeQuest(q), q.title).toBe(true);
    }
    expect(new Set(FALLBACK_QUESTS.map((q) => q.title)).size).toBe(25);
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

  it('still makes a palette from a blank image', () => {
    const palette = paletteFromPixels(new Uint8ClampedArray(0), 99);
    expect(palette.primary).toMatch(/^hsl\(/);
  });
});
