import { localCreature, rollLook } from '../creatures/hatch';
import type { Palette, Rarity } from '../creatures/creatureSchemas';
import type { CreatureLook } from '../creatures/CreatureRenderer';

export type Specimen = CreatureLook & { id: string; species: string };

/**
 * Example creatures for the landing page when nothing has hatched yet. Built by the same
 * local generator the app falls back on, with palettes like ones pulled from real photos.
 */
const SAMPLES: { seed: number; rarity: Rarity; palette: Palette }[] = [
  { seed: 4127, rarity: 'rare', palette: { primary: 'hsl(140 48% 56%)', secondary: 'hsl(140 34% 86%)', accent: 'hsl(345 70% 66%)' } },
  { seed: 90211, rarity: 'common', palette: { primary: 'hsl(32 58% 60%)', secondary: 'hsl(32 40% 85%)', accent: 'hsl(190 60% 62%)' } },
  { seed: 5150, rarity: 'uncommon', palette: { primary: 'hsl(205 45% 62%)', secondary: 'hsl(205 32% 87%)', accent: 'hsl(48 75% 62%)' } },
  { seed: 777, rarity: 'common', palette: { primary: 'hsl(80 42% 55%)', secondary: 'hsl(80 30% 84%)', accent: 'hsl(12 72% 64%)' } },
  { seed: 31337, rarity: 'uncommon', palette: { primary: 'hsl(330 40% 66%)', secondary: 'hsl(330 30% 88%)', accent: 'hsl(150 55% 58%)' } },
  { seed: 6006, rarity: 'common', palette: { primary: 'hsl(265 30% 64%)', secondary: 'hsl(265 25% 87%)', accent: 'hsl(95 55% 58%)' } },
];

export const sampleSpecimens: Specimen[] = SAMPLES.map(({ seed, rarity, palette }) => ({
  ...localCreature(seed, []),
  ...rollLook(seed),
  id: `sample-${seed}`,
  seed,
  rarity,
  palette,
}));
