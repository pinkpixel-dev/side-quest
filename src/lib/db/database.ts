import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Quest } from '../../features/quests/questSchemas';
import type { Creature } from '../../features/creatures/creatureSchemas';
import type { Hunt } from '../../features/hunts/huntSchemas';
import type { FindStatus } from '../home/protocol';

export interface StoredPhoto {
  id: string;
  blob: Blob;
  createdAt: number;
}

/** Field mode: a photo on its way to (or back from) the home base. */
export interface LocalFind {
  id: string;
  quest: Quest;
  photo: Blob;
  createdAt: number;
  /** `queued` = still on the phone (offline or not sent yet). */
  status: 'queued' | FindStatus;
  creatureId?: string;
  reason?: string;
  /** The player has seen how it turned out. */
  seen: boolean;
}

/**
 * Photos are stored as raw bytes, not Blobs: iOS Safari has a history of refusing to put
 * Blobs into IndexedDB. Older records may still hold a Blob, so reading accepts both.
 */
interface StoredBytes {
  bytes: ArrayBuffer;
  type: string;
}
type PhotoData = Blob | StoredBytes;

const toBytes = async (blob: Blob): Promise<StoredBytes> => ({ bytes: await blob.arrayBuffer(), type: blob.type });
const fromBytes = (data: PhotoData): Blob => (data instanceof Blob ? data : new Blob([data.bytes], { type: data.type }));

type Row<T, K extends keyof T> = Omit<T, K> & Record<K, PhotoData>;

interface SideQuestDB extends DBSchema {
  quests: { key: string; value: Quest; indexes: { createdAt: number } };
  creatures: { key: string; value: Creature; indexes: { discoveredAt: number } };
  photos: { key: string; value: Row<StoredPhoto, 'blob'> };
  settings: { key: string; value: unknown };
  finds: { key: string; value: Row<LocalFind, 'photo'> };
  hunts: { key: string; value: Hunt };
}

let dbPromise: Promise<IDBPDatabase<SideQuestDB>> | null = null;

export function db(): Promise<IDBPDatabase<SideQuestDB>> {
  dbPromise ??= openDB<SideQuestDB>('side-quest', 3, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('quests', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
        d.createObjectStore('creatures', { keyPath: 'id' }).createIndex('discoveredAt', 'discoveredAt');
        d.createObjectStore('photos', { keyPath: 'id' });
        d.createObjectStore('settings');
      }
      if (oldVersion < 2) d.createObjectStore('finds', { keyPath: 'id' });
      if (oldVersion < 3) d.createObjectStore('hunts', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

/** Test hook: closes the connection so each test can start from a fresh database. */
export async function resetDbForTests(): Promise<void> {
  (await dbPromise)?.close();
  dbPromise = null;
}

// --- quests ---------------------------------------------------------------------

export async function saveQuest(quest: Quest): Promise<void> {
  await (await db()).put('quests', quest);
}

export async function getQuest(id: string): Promise<Quest | undefined> {
  return (await db()).get('quests', id);
}

export async function recentQuests(limit = 12): Promise<Quest[]> {
  const all = await (await db()).getAllFromIndex('quests', 'createdAt');
  return all.slice(-limit).reverse();
}

// --- creatures ------------------------------------------------------------------

export async function saveCreature(creature: Creature, photo?: StoredPhoto): Promise<void> {
  // Read the bytes before opening the transaction: IndexedDB transactions close across unrelated awaits.
  const photoRow = photo && { ...photo, blob: await toBytes(photo.blob) };
  const tx = (await db()).transaction(['creatures', 'photos'], 'readwrite');
  if (photoRow) await tx.objectStore('photos').put(photoRow);
  await tx.objectStore('creatures').put(creature);
  await tx.done;
}

export async function getCreature(id: string): Promise<Creature | undefined> {
  return (await db()).get('creatures', id);
}

/** Newest first. */
export async function allCreatures(): Promise<Creature[]> {
  return (await (await db()).getAllFromIndex('creatures', 'discoveredAt')).reverse();
}

/** Body / eyes / accessory of the newest few creatures, so new ones can steer away from them. */
export async function recentCreatureTraits(limit = 5): Promise<Pick<Creature, 'body' | 'eyeStyle' | 'accessory'>[]> {
  return (await allCreatures()).slice(0, limit).map(({ body, eyeStyle, accessory }) => ({ body, eyeStyle, accessory }));
}

/** A photo on its own, e.g. a hunt snap that isn't attached to a creature (yet). */
export async function savePhoto(photo: StoredPhoto): Promise<void> {
  const row = { ...photo, blob: await toBytes(photo.blob) };
  await (await db()).put('photos', row);
}

export async function deletePhoto(id: string): Promise<void> {
  await (await db()).delete('photos', id);
}

export async function getPhoto(id: string): Promise<StoredPhoto | undefined> {
  const row = await (await db()).get('photos', id);
  return row && { ...row, blob: fromBytes(row.blob) };
}

// --- settings -------------------------------------------------------------------

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('settings', key)) as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).put('settings', value, key);
}

// --- field finds ----------------------------------------------------------------

export async function saveFind(find: LocalFind): Promise<void> {
  const row = { ...find, photo: await toBytes(find.photo) };
  await (await db()).put('finds', row);
}

export async function allFinds(): Promise<LocalFind[]> {
  return (await (await db()).getAll('finds')).map((row) => ({ ...row, photo: fromBytes(row.photo) }));
}

// --- hunts ----------------------------------------------------------------------

export async function saveHunt(hunt: Hunt): Promise<void> {
  await (await db()).put('hunts', hunt);
}

export async function getHunt(id: string): Promise<Hunt | undefined> {
  return (await db()).get('hunts', id);
}

export async function allHunts(): Promise<Hunt[]> {
  return (await db()).getAll('hunts');
}
