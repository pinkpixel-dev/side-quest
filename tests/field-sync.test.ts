import 'fake-indexeddb/auto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHomeServer } from '../server/app';
import { Store } from '../server/store';
import { allCreatures, allFinds, getPhoto, getQuest, resetDbForTests } from '../src/lib/db/database';
import { pairingFromHash, type Pairing } from '../src/lib/home/client';
import { startNewQuest } from '../src/features/quests/questService';
import { retryFind, submitFind, syncFinds } from '../src/features/field/fieldSync';

let dir: string;
let store: Store;
let server: Server;
let pairing: Pairing;
let base: string;

beforeEach(async () => {
  await resetDbForTests();
  await new Promise<void>((r) => {
    const req = indexedDB.deleteDatabase('side-quest');
    req.onsuccess = req.onerror = () => r();
  });
  dir = mkdtempSync(join(tmpdir(), 'side-quest-field-'));
  store = new Store(dir);
  server = createHomeServer({ store, session: () => ({ tunnelUrl: null, pairUrl: null, qrSvg: null }) });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  pairing = { baseUrl: base, token: store.token };
});

afterEach(async () => {
  await new Promise((r) => server.close(r));
  rmSync(dir, { recursive: true, force: true });
});

const resolve = (id: string, body: object) =>
  fetch(`${base}/api/finds/${id}/result`, { method: 'POST', body: JSON.stringify(body) });

describe('pairing links', () => {
  it('reads the token, with or without a separate base URL', () => {
    expect(pairingFromHash('#token=abc', 'https://x.trycloudflare.com')).toEqual({
      baseUrl: 'https://x.trycloudflare.com',
      token: 'abc',
    });
    expect(pairingFromHash('#base=https%3A%2F%2Fy.trycloudflare.com%2F&token=t', 'https://app.dev')).toEqual({
      baseUrl: 'https://y.trycloudflare.com',
      token: 't',
    });
    expect(pairingFromHash('#base=javascript%3Aalert(1)&token=t', 'https://app.dev')).toBeNull();
    expect(pairingFromHash('', 'https://app.dev')).toBeNull();
  });
});

describe('field sync against a real home server', () => {
  it('queues offline, uploads later, and brings the creature home with the photo', async () => {
    const quest = await startNewQuest(null);
    const photo = new Blob([new Uint8Array([0xff, 0xd8, 1, 2, 3])], { type: 'image/jpeg' });
    const find = await submitFind(quest, photo);
    expect((await getQuest(quest.id))?.status).toBe('submitted');

    // No signal: the upload fails and the photo stays queued on the phone.
    await expect(syncFinds({ ...pairing, baseUrl: 'http://127.0.0.1:9' })).rejects.toThrow();
    expect((await allFinds())[0].status).toBe('queued');

    // Back online.
    await syncFinds(pairing);
    expect((await allFinds())[0].status).toBe('waiting');
    expect(store.waitingFinds()).toHaveLength(1);

    const creature = {
      id: 'c1', name: 'Rootlet', species: 'Concrete Sprout', description: 'Likes edges.', body: 'sprout',
      eyeStyle: 'dot', accessory: 'leaf', rarity: 'common', seed: 1, questId: quest.id, questTitle: quest.title,
      palette: { primary: 'hsl(1 1% 1%)', secondary: 'hsl(1 1% 1%)', accent: 'hsl(1 1% 1%)' },
      observations: [], photoId: 'base-photo', generatedLocally: false, discoveredAt: 2,
    };
    await resolve(find.id, { status: 'hatched', creature });
    await syncFinds(pairing);

    const [local] = await allFinds();
    expect(local).toMatchObject({ status: 'hatched', creatureId: 'c1', seen: false });
    expect((await allCreatures())[0].name).toBe('Rootlet');
    expect((await getPhoto('base-photo'))?.blob.size).toBe(photo.size);
    expect((await getQuest(quest.id))?.status).toBe('completed');
  });

  it('a "not quite" puts the quest back in play', async () => {
    const quest = await startNewQuest(null);
    const find = await submitFind(quest, new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    await syncFinds(pairing);
    await resolve(find.id, { status: 'not-quite', reason: 'No plant in sight.' });
    await syncFinds(pairing);

    const [local] = await allFinds();
    expect(local).toMatchObject({ status: 'not-quite', reason: 'No plant in sight.' });
    await retryFind(local);
    expect((await getQuest(quest.id))?.status).toBe('active');
  });
});
