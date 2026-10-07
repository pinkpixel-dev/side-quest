import { z } from 'zod';

export const BODIES = ['blob', 'round', 'sprout', 'pebble', 'fuzzy', 'droplet'] as const;
export const EYES = ['dot', 'wide', 'sleepy', 'sparkle'] as const;
export const ACCESSORIES = ['leaf', 'flower', 'twig', 'mushroom', 'stone', 'none'] as const;
export const RARITIES = ['common', 'uncommon', 'rare'] as const;

export type CreatureBody = (typeof BODIES)[number];
export type CreatureEyes = (typeof EYES)[number];
export type CreatureAccessory = (typeof ACCESSORIES)[number];
export type Rarity = (typeof RARITIES)[number];

/** Traits Gemma writes. Enum slips fall back to a default instead of losing the creature. */
export const creatureTraitsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(18)
    .regex(/^[\p{L}' -]+$/u),
  species: z.string().trim().min(3).max(40),
  description: z.string().trim().min(10).max(260),
  body: z.enum(BODIES).catch('blob'),
  eyeStyle: z.enum(EYES).catch('dot'),
  accessory: z.enum(ACCESSORIES).catch('none'),
});
export type CreatureTraits = z.infer<typeof creatureTraitsSchema>;

/** One Gemma call: did the photo match, what's in it, and who lives there. */
export const judgementSchema = z.object({
  passed: z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean()),
  confidence: z.enum(['low', 'medium', 'high']).catch('medium'),
  reason: z.string().trim().max(300).catch(''),
  observations: z.array(z.string().trim().min(1).max(60)).max(6).catch([]),
  creature: creatureTraitsSchema.nullable().catch(null),
});
export type Judgement = z.infer<typeof judgementSchema>;

export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
}

export interface Creature extends CreatureTraits {
  id: string;
  rarity: Rarity;
  palette: Palette;
  seed: number;
  questId: string;
  questTitle: string;
  observations: string[];
  photoId?: string;
  /** True when Gemma couldn't write traits and the local generator filled in. */
  generatedLocally: boolean;
  discoveredAt: number;
}
