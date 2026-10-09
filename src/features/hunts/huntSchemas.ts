import { z } from 'zod';
import type { Rarity } from '../creatures/creatureSchemas';
import { isPlain, isSafeQuest } from '../quests/questSchemas';

export const HUNT_SIZE = 10;
/** Fewer finds than this and there's no egg. */
export const MIN_TO_HATCH = 5;

export interface HuntItem {
  id: string;
  /** Short and photographable, like "something red" or "a bird". */
  text: string;
  /** Set once the player has snapped it. Lives in the photos store. */
  photoId?: string;
  /** Gemma's verdict, filled in after the hunt is checked. */
  found?: boolean;
  reason?: string;
}

/**
 * active    - out snapping
 * queued    - field mode: finished, still on the phone
 * waiting   - field mode: at home, waiting on Gemma
 * completed - checked, with or without a creature
 */
export type HuntStatus = 'active' | 'queued' | 'waiting' | 'completed' | 'abandoned';

export interface Hunt {
  id: string;
  title: string;
  items: HuntItem[];
  source: 'gemma' | 'library';
  status: HuntStatus;
  createdAt: number;
  creatureId?: string;
  /** Field mode: the player has seen how it turned out. */
  seen?: boolean;
}

/** What Gemma writes. Short or partly unsafe lists get topped up from the library. */
export const huntDraftSchema = z.object({
  title: z.string().trim().min(2).max(40).catch('Scavenger Hunt'),
  items: z.array(z.string().trim().min(3).max(60)).min(4),
});
export type HuntDraft = z.infer<typeof huntDraftSchema>;

export const huntCheckSchema = z.object({
  found: z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean()),
  reason: z.string().trim().max(200).catch(''),
});
export type HuntCheck = z.infer<typeof huntCheckSchema>;

/** Drops unsafe or poetic items and near-duplicates. Comparison ignores case and a leading "a"/"an"/"something". */
export function cleanItems(items: string[]): string[] {
  const key = (s: string) =>
    s
      .toLowerCase()
      .replace(/^(a|an|some|something)\s+/, '')
      .replace(/[^a-z ]/g, '')
      .trim();
  const seen = new Set<string>();
  return items.filter((text) => {
    const k = key(text);
    const item = { title: '', description: text };
    if (!k || seen.has(k) || !isSafeQuest(item) || !isPlain(item)) return false;
    seen.add(k);
    return true;
  });
}

/** More finds, better egg: 5+ is at least uncommon, a full sweep is always rare. */
export function huntRarity(rolled: Rarity, found: number): Rarity {
  if (found >= HUNT_SIZE) return 'rare';
  if (found >= MIN_TO_HATCH && rolled === 'common') return 'uncommon';
  return rolled;
}

export const foundCount = (hunt: Pick<Hunt, 'items'>) => hunt.items.filter((i) => i.found).length;
export const snappedCount = (hunt: Pick<Hunt, 'items'>) => hunt.items.filter((i) => i.photoId).length;
