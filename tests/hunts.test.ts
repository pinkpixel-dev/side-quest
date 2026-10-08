import 'fake-indexeddb/auto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHomeServer } from '../server/app';
import { Store } from '../server/store';
import { allCreatures, getHunt, getPhoto, getSetting, resetDbForTests } from '../src/lib/db/database';
import type { Pairing } from '../src/lib/home/client';
import { HUNT_ITEMS, fitsContext, libraryItemsFor } from '../src/features/hunts/huntLibrary';
import { huntPrompt } from '../src/features/hunts/huntPrompts';
import { HUNT_SIZE, cleanItems, huntRarity } from '../src/features/hunts/huntSchemas';
import { abandonHunt, applyVerdict, fromDraft, snapItem, startHunt } from '../src/features/hunts/huntService';
import { submitHunt, syncHunts } from '../src/features/hunts/huntSync';
import { isSafeQuest } from '../src/features/quests/questSchemas';
import { SEASONS, SETTINGS, TIMES, WEATHERS, type QuestContext } from '../src/features/quests/questContext';

const park: QuestContext = { setting: 'park', weather: 'sunny', season: 'summer', time: 'afternoon' };
const jpeg = (byte: number) => new Blob([new Uint8Array([0xff, 0xd8, byte])], { type: 'image/jpeg' });

beforeEach(async () => {
  await resetDbForTests();
  await new Promise<void>((r) => {
    const req = indexedDB.deleteDatabase('side-quest');
    req.onsuccess = req.onerror = () => r();
  });
});

describe('hunt lists', () => {
  it('has at least ten safe library items for every possible context', () => {
    for (const item of HUNT_ITEMS) expect(isSafeQuest({ title: '', description: item.text }), item.text).toBe(true);
    for (const setting of SETTINGS)
      for (const weather of WEATHERS)
        for (const season of SEASONS)
          for (const time of TIMES) {
            const items = libraryItemsFor({ setting, weather, season, time });
            expect(items.length, `${setting}/${weather}/${season}/${time}`).toBeGreaterThanOrEqual(HUNT_SIZE);
          }
  });

  it('keeps night items at night and winter-only-absent items out of winter', () => {
    const moon = HUNT_ITEMS.find((i) => i.text === 'the moon')!;
    expect(fitsContext(moon, park)).toBe(false);
    expect(fitsContext(moon, { ...park, time: 'night' })).toBe(true);
    expect(libraryItemsFor({ ...park, season: 'winter' })).not.toContain('a flower');
  });

  it('drops unsafe and duplicate items', () => {
    expect(cleanItems(['something red', 'Something Red!', 'a red thing', 'pet a squirrel', 'climb a tree'])).toEqual([
      'something red',
      'a red thing',
    ]);
  });

  it('tops up a short Gemma list to ten and rejects one that is mostly unusable', () => {
    const draft = fromDraft({ title: 'Park Patrol', items: ['a blue bench', 'a crooked tree', 'a squirrel tail', 'a lost glove'] }, park);
    expect(draft?.items).toHaveLength(HUNT_SIZE);
    expect(draft?.items.slice(0, 4)).toEqual(['a blue bench', 'a crooked tree', 'a squirrel tail', 'a lost glove']);
    expect(fromDraft({ title: 'Nope', items: ['climb a fence', 'wade in the pond', 'eat a berry', 'a rock'] }, park)).toBeNull();
  });

  it('gives Gemma the context and some style examples', () => {
    const prompt = huntPrompt({ ...park, time: 'night' }, ['the moon', 'a colored light']);
    expect(prompt).toContain('It is dark out');
    expect(prompt).toContain('"the moon", "a colored light"');
  });

  it('boosts rarity with more finds', () => {
    expect(huntRarity('common', 3)).toBe('common');
    expect(huntRarity('common', 5)).toBe('uncommon');
    expect(huntRarity('rare', 6)).toBe('rare');
    expect(huntRarity('common', 10)).toBe('rare');
  });
});

describe('hunt persistence', () => {
  it('starts a library hunt without Gemma, swaps retaken photos, and cleans up when dropped', async () => {
    const hunt = await startHunt(null, park);
    expect(hunt).toMatchObject({ source: 'library', status: 'active' });
    expect(hunt.items).toHaveLength(HUNT_SIZE);
    expect(await getSetting('activeHuntId')).toBe(hunt.id);

    const first = await snapItem(hunt, hunt.items[0].id, jpeg(1));
    const oldPhoto = first.items[0].photoId!;
    const retaken = await snapItem(first, hunt.items[0].id, jpeg(2));
    expect(retaken.items[0].photoId).not.toBe(oldPhoto);
    expect(await getPhoto(oldPhoto)).toBeUndefined();
    expect((await getHunt(hunt.id))?.items[0].photoId).toBe(retaken.items[0].photoId);

    await abandonHunt(retaken);
    expect(await getPhoto(retaken.items[0].photoId!)).toBeUndefined();
    expect((await getHunt(hunt.id))?.status).toBe('abandoned');
    expect(await getSetting('activeHuntId')).toBeNull();
  });

  it('marks unchecked items as not found when applying a verdict', async () => {
    const hunt = await startHunt(null, park);
    const done = applyVerdict(hunt, { items: [{ id: hunt.items[0].id, found: true, reason: 'Nice' }] });
    expect(done.status).toBe('completed');
    expect(done.items[0]).toMatchObject({ found: true, reason: 'Nice' });
    expect(done.items.slice(1).every((i) => i.found === false)).toBe(true);
  });
});

describe('field hunts against a real home server', () => {
  let dir: string;
  let store: Store;
  let server: Server;
  let base: string;
  let pairing: Pairing;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'side-quest-hunt-'));
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

  it('queues offline, uploads later, and brings the hunt result and creature home', async () => {
    let hunt = await startHunt(null, park);
    for (let i = 0; i < 6; i++) hunt = await snapItem(hunt, hunt.items[i].id, jpeg(i));
    await submitHunt(hunt);
    expect(await getSetting('activeHuntId')).toBeNull();

    await expect(syncHunts({ ...pairing, baseUrl: 'http://127.0.0.1:9' })).rejects.toThrow();
    expect((await getHunt(hunt.id))?.status).toBe('queued');

    await syncHunts(pairing);
    expect((await getHunt(hunt.id))?.status).toBe('waiting');
    const [waiting] = store.waitingHunts();
    expect(waiting.items).toHaveLength(6);

    // The base tab reads a photo, then reports back.
    const photo = await fetch(`${base}/api/base/hunts/${hunt.id}/photo/${hunt.items[2].id}`);
    expect(new Uint8Array(await photo.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 2]));
    const creature = {
      id: 'c-hunt', name: 'Scrambit', species: 'Park Sweeper', description: 'Finds everything.', body: 'round',
      eyeStyle: 'wide', accessory: 'none', rarity: 'uncommon', seed: 3, questId: hunt.id, questTitle: hunt.title,
      palette: { primary: 'hsl(1 1% 1%)', secondary: 'hsl(1 1% 1%)', accent: 'hsl(1 1% 1%)' },
      observations: [], photoId: 'base-copy', generatedLocally: false, discoveredAt: 4,
    };
    const items = waiting.items.map((i, n) => ({ id: i.id, found: n < 5, reason: 'ok' }));
    await fetch(`${base}/api/base/hunts/${hunt.id}/result`, {
      method: 'POST',
      body: JSON.stringify({ items, creature, pickedItemId: hunt.items[1].id }),
    });

    await syncHunts(pairing);
    const local = (await getHunt(hunt.id))!;
    expect(local).toMatchObject({ status: 'completed', creatureId: 'c-hunt', seen: false });
    expect(local.items.filter((i) => i.found)).toHaveLength(5);
    const [saved] = await allCreatures();
    // The creature points at the phone's own copy of the picked photo.
    expect(saved.photoId).toBe(hunt.items[1].photoId);
    expect((await getPhoto(saved.photoId!))?.blob.size).toBe(3);
  });

  it('keeps hunt base endpoints off the tunnel and rejects bad uploads', async () => {
    const tunnel = { 'cf-ray': 'x', authorization: `Bearer ${store.token}` };
    expect((await fetch(`${base}/api/base/hunts/h/photo/i`, { headers: tunnel })).status).toBe(403);
    const bad = { id: 'h1', title: 'Bad', createdAt: 1, items: [{ id: 'i1', text: 'x', photo: 'data:text/html;base64,PGgxPg==' }] };
    const res = await fetch(`${base}/api/hunts`, { method: 'POST', headers: tunnel, body: JSON.stringify(bad) });
    expect(res.status).toBe(400);
  });

  it('hands out a pre-written hunt once, and drops it when the context changes', async () => {
    const next = (context: object) =>
      fetch(`${base}/api/hunts/next`, {
        method: 'POST',
        headers: { 'cf-ray': 'x', authorization: `Bearer ${store.token}` },
        body: JSON.stringify({ context }),
      });
    const add = (context: object) =>
      fetch(`${base}/api/base/hunt-pool`, {
        method: 'POST',
        body: JSON.stringify({ hunt: { title: 'Park Patrol', items: ['a bench'] }, context }),
      });

    expect((await next(park)).status).toBe(204);
    await add(park);
    expect(((await (await next(park)).json()) as { title: string }).title).toBe('Park Patrol');
    expect((await next(park)).status).toBe(204);

    await add(park);
    expect((await next({ ...park, time: 'night' })).status).toBe(204);
  });
});
