import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Quest } from '../../features/quests/questSchemas';
import type { Creature } from '../../features/creatures/creatureSchemas';

export interface StoredPhoto {
  id: string;
  blob: Blob;
  createdAt: number;
}

interface SideQuestDB extends DBSchema {
  quests: { key: string; value: Quest; indexes: { createdAt: number } };
  creatures: { key: string; value: Creature; indexes: { discoveredAt: number } };
  photos: { key: string; value: StoredPhoto };
  settings: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<SideQuestDB>> | null = null;

export function db(): Promise<IDBPDatabase<SideQuestDB>> {
  dbPromise ??= openDB<SideQuestDB>('side-quest', 1, {
    upgrade(d) {
      d.createObjectStore('quests', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      d.createObjectStore('creatures', { keyPath: 'id' }).createIndex('discoveredAt', 'discoveredAt');
      d.createObjectStore('photos', { keyPath: 'id' });
      d.createObjectStore('settings');
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
