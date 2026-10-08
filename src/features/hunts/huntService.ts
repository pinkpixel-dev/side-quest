import type { GemmaClient } from '../../lib/gemma/client';
import { generateStructured } from '../../lib/ai/structured';
import { allHunts, deletePhoto, getPhoto, recentCreatureTraits, saveHunt, savePhoto, setSetting } from '../../lib/db/database';
import { newId, seedFromBlob } from '../../lib/random';
import type { Creature } from '../creatures/creatureSchemas';
import { hatchCreature } from '../creatures/creatureService';
import { paletteFromPhoto, rollRarity } from '../creatures/hatch';
import { IMAGE_BUDGET, judgeFind } from '../proof/judgeService';
import type { QuestContext } from '../quests/questContext';
import type { Quest } from '../quests/questSchemas';
import { HUNT_TITLES, libraryItemsFor } from './huntLibrary';
import { CHECK_SHAPE, CHECK_SYSTEM, HUNT_SHAPE, HUNT_SYSTEM, checkPrompt, huntPrompt } from './huntPrompts';
import {
  HUNT_SIZE,
  MIN_TO_HATCH,
  cleanItems,
  huntCheckSchema,
  huntDraftSchema,
  huntRarity,
  type Hunt,
  type HuntDraft,
  type HuntItem,
} from './huntSchemas';

const shuffle = <T>(items: readonly T[]): T[] => [...items].sort(() => Math.random() - 0.5);

/** Items from the last couple of hunts, so the next list doesn't feel like a rerun. */
async function recentItems(): Promise<string[]> {
  const hunts = (await allHunts()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 2);
  return hunts.flatMap((h) => h.items.map((i) => i.text));
}

/** Fills a list up to ten from the library, preferring items that weren't in recent hunts. */
export function topUp(items: string[], context: QuestContext | null, recent: string[] = []): string[] {
  const pool = shuffle(libraryItemsFor(context));
  const fresh = pool.filter((t) => !recent.includes(t));
  return cleanItems([...items, ...fresh, ...pool]).slice(0, HUNT_SIZE);
}

export function libraryHunt(context: QuestContext | null, recent: string[] = []): HuntDraft {
  return { title: shuffle(HUNT_TITLES)[0], items: topUp([], context, recent) };
}

/** Has Gemma write a list. Null when it never made usable JSON or most of it was unsafe. */
export async function writeHunt(
  gemma: GemmaClient,
  context: QuestContext | null,
  recent: string[] = [],
): Promise<HuntDraft | null> {
  const draft = await generateStructured(
    gemma,
    {
      system: HUNT_SYSTEM,
      prompt: huntPrompt(context, shuffle(libraryItemsFor(context)).slice(0, 4)),
      maxTokens: 200,
      sample: true,
    },
    { schema: huntDraftSchema, shape: HUNT_SHAPE },
  );
  return draft ? fromDraft(draft, context, recent) : null;
}

/** Cleans a list from Gemma (here or at home base). Null when too little of it survived. */
export function fromDraft(draft: HuntDraft, context: QuestContext | null, recent: string[] = []): HuntDraft | null {
  const items = cleanItems(draft.items).slice(0, HUNT_SIZE);
  return items.length >= 4 ? { title: draft.title, items: topUp(items, context, recent) } : null;
}

/** Makes the next hunt and marks it active. Gemma (or home base) when possible, otherwise the library. */
export async function startHunt(
  gemma: GemmaClient | null,
  context: QuestContext | null,
  fromHome?: () => Promise<HuntDraft | null>,
): Promise<Hunt> {
  const recent = await recentItems();
  let draft: HuntDraft | null = null;
  if (fromHome) {
    const remote = await fromHome().catch(() => null);
    const parsed = remote ? huntDraftSchema.safeParse(remote) : null;
    if (parsed?.success) draft = fromDraft(parsed.data, context, recent);
  } else if (gemma?.state.status === 'ready') {
    draft = await writeHunt(gemma, context, recent).catch(() => null);
  }
  const source = draft ? 'gemma' : 'library';
  draft ??= libraryHunt(context, recent);

  const hunt: Hunt = {
    id: newId(),
    title: draft.title,
    items: draft.items.map((text) => ({ id: newId(), text })),
    source,
    status: 'active',
    createdAt: Date.now(),
  };
  await saveHunt(hunt);
  await setSetting('activeHuntId', hunt.id);
  return hunt;
}

/** Saves (or replaces) the photo for one item. */
export async function snapItem(hunt: Hunt, itemId: string, photo: Blob): Promise<Hunt> {
  const item = hunt.items.find((i) => i.id === itemId);
  if (!item) return hunt;
  const photoId = newId();
  await savePhoto({ id: photoId, blob: photo, createdAt: Date.now() });
  if (item.photoId) await deletePhoto(item.photoId);
  const next = { ...hunt, items: hunt.items.map((i) => (i.id === itemId ? { ...i, photoId } : i)) };
  await saveHunt(next);
  return next;
}

export async function abandonHunt(hunt: Hunt): Promise<void> {
  await Promise.all(hunt.items.filter((i) => i.photoId).map((i) => deletePhoto(i.photoId!)));
  await saveHunt({ ...hunt, status: 'abandoned', items: hunt.items.map(({ photoId: _p, ...i }) => i) });
  await setSetting('activeHuntId', null);
}

// --- judging (solo and home base) --------------------------------------------------

export interface HuntVerdict {
  items: { id: string; found: boolean; reason: string }[];
  creature?: Creature;
  /** The item whose photo the creature hatched from. */
  pickedItemId?: string;
}

/** Quick yes/no for one photo. Gemma losing the thread counts as not found. */
export async function checkItem(gemma: GemmaClient, text: string, photo: Blob): Promise<{ found: boolean; reason: string }> {
  const check = await generateStructured(
    gemma,
    { system: CHECK_SYSTEM, prompt: checkPrompt(text), image: photo, imageBudget: IMAGE_BUDGET, maxTokens: 48 },
    { schema: huntCheckSchema, shape: CHECK_SHAPE },
  ).catch(() => null);
  return check ?? { found: false, reason: "Gemma couldn't tell." };
}

/** Stands in for a quest so the regular creature pipeline can hatch from a hunt photo. */
function huntQuest(hunt: Pick<Hunt, 'id' | 'title' | 'createdAt'>, item: Pick<HuntItem, 'text'>): Quest {
  return {
    id: hunt.id,
    title: hunt.title,
    description: `Finished a scavenger hunt. This photo shows ${item.text}.`,
    validationHint: 'Any photo from the hunt counts, so pass it.',
    category: 'observation',
    difficulty: 'easy',
    estimatedMinutes: 30,
    source: 'library',
    status: 'completed',
    createdAt: hunt.createdAt,
  };
}

/**
 * Checks every snapped item one after another, then hatches one creature from a random
 * found photo when enough turned up. `photoOf` hides where the photos live.
 */
export async function judgeHunt(
  gemma: GemmaClient,
  hunt: Pick<Hunt, 'id' | 'title' | 'createdAt'> & { items: Pick<HuntItem, 'id' | 'text'>[] },
  photoOf: (itemId: string) => Promise<Blob>,
  onProgress?: (done: number, total: number, last?: HuntVerdict['items'][number]) => void,
): Promise<HuntVerdict> {
  const results: HuntVerdict['items'] = [];
  onProgress?.(0, hunt.items.length);
  for (const item of hunt.items) {
    const result = { id: item.id, ...(await checkItem(gemma, item.text, await photoOf(item.id))) };
    results.push(result);
    onProgress?.(results.length, hunt.items.length, result);
  }

  const found = results.filter((r) => r.found);
  if (found.length < MIN_TO_HATCH) return { items: results };

  const picked = hunt.items.find((i) => i.id === found[Math.floor(Math.random() * found.length)].id)!;
  const photo = await photoOf(picked.id);
  const seed = await seedFromBlob(photo);
  const rarity = huntRarity(rollRarity(seed), found.length);
  const quest = huntQuest(hunt, picked);
  const [palette, judgement] = await Promise.all([
    paletteFromPhoto(photo, seed),
    judgeFind(gemma, quest, photo, rarity, undefined, await recentCreatureTraits()).catch(() => null),
  ]);
  const creature = await hatchCreature({
    quest,
    photo,
    seed,
    rarity,
    palette,
    // The hunt already passed; only the creature traits matter here.
    judgement: judgement
      ? { ...judgement, passed: true }
      : { passed: true, confidence: 'medium', reason: '', observations: [], creature: null },
    closeQuest: false,
  });
  return { items: results, creature, pickedItemId: picked.id };
}

/** Writes the verdict onto the hunt and closes it. */
export function applyVerdict(hunt: Hunt, verdict: HuntVerdict): Hunt {
  const byId = new Map(verdict.items.map((r) => [r.id, r]));
  return {
    ...hunt,
    status: 'completed',
    creatureId: verdict.creature?.id,
    items: hunt.items.map((i) => {
      const r = byId.get(i.id);
      return r ? { ...i, found: r.found, reason: r.reason } : { ...i, found: false };
    }),
  };
}

/** Solo mode: Gemma is right here, so check the whole hunt now. */
export async function finishHunt(gemma: GemmaClient, hunt: Hunt, onProgress?: Parameters<typeof judgeHunt>[3]): Promise<Hunt> {
  const snapped = hunt.items.filter((i) => i.photoId);
  const verdict = await judgeHunt(
    gemma,
    { ...hunt, items: snapped },
    async (itemId) => {
      const photo = await getPhoto(snapped.find((i) => i.id === itemId)!.photoId!);
      if (!photo) throw new Error('Hunt photo went missing');
      return photo.blob;
    },
    onProgress,
  );
  const done = { ...applyVerdict(hunt, verdict), seen: true };
  await saveHunt(done);
  await setSetting('activeHuntId', null);
  return done;
}
