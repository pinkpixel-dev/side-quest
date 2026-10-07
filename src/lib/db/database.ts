import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Quest } from '../../features/quests/questSchemas';
import type { Creature } from '../../features/creatures/creatureSchemas';
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

interface SideQuestDB extends DBSchema {
  quests: { key: string; value: Quest; indexes: { createdAt: number } };
  creatures: { key: string; value: Creature; indexes: { discoveredAt: number } };
  photos: { key: string; value: StoredPhoto };
  settings: { key: string; value: unknown };
  finds: { key: string; value: LocalFind };
}

let dbPromise: Promise<IDBPDatabase<SideQuestDB>> | null = null;

export function db(): Promise<IDBPDatabase<SideQuestDB>> {
  dbPromise ??= openDB<SideQuestDB>('side-quest', 2, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('quests', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
        d.createObjectStore('creatures', { keyPath: 'id' }).createIndex('discoveredAt', 'discoveredAt');
        d.createObjectStore('photos', { keyPath: 'id' });
        d.createObjectStore('settings');
      }
      if (oldVersion < 2) d.createObjectStore('finds', { keyPath: 'id' });
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
  const tx = (await db()).transaction(['creatures', 'photos'], 'readwrite');
  if (photo) await tx.objectStore('photos').put(photo);
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

export async function getPhoto(id: string): Promise<StoredPhoto | undefined> {
  return (await db()).get('photos', id);
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
  await (await db()).put('finds', find);
}

export async function allFinds(): Promise<LocalFind[]> {
  return (await db()).getAll('finds');
}
