import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHomeServer } from '../server/app';
import { Store } from '../server/store';
import { FALLBACK_QUESTS } from '../src/features/quests/fallbackQuests';
import type { Quest } from '../src/features/quests/questSchemas';

let dir: string;
let store: Store;
let server: Server;
let base: string;

const quest: Quest = { ...FALLBACK_QUESTS[0], id: 'q1', source: 'library', status: 'active', createdAt: 1 };
const jpeg = `data:image/jpeg;base64,${Buffer.from('fake jpeg').toString('base64')}`;
/** What a request through cloudflared looks like. */
const viaTunnel = (extra: Record<string, string> = {}) => ({ 'cf-ray': 'abc123', ...extra });
const paired = () => viaTunnel({ authorization: `Bearer ${store.token}`, 'content-type': 'application/json' });

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'side-quest-'));
  store = new Store(dir);
  server = createHomeServer({ store, session: () => ({ tunnelUrl: null, pairUrl: null, qrSvg: null }) });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((r) => server.close(r));
  rmSync(dir, { recursive: true, force: true });
});

describe('home server security', () => {
  it('refuses tunnel requests without the pairing token', async () => {
    expect((await fetch(`${base}/api/hello`, { headers: viaTunnel() })).status).toBe(401);
    const wrong = viaTunnel({ authorization: 'Bearer nope' });
    expect((await fetch(`${base}/api/hello`, { headers: wrong })).status).toBe(401);
  });

  it('never hands the token or base endpoints out through the tunnel', async () => {
    expect((await fetch(`${base}/api/base/session`, { headers: paired() })).status).toBe(403);
    const result = await fetch(`${base}/api/finds/x/result`, { method: 'POST', headers: paired(), body: '{}' });
    expect(result.status).toBe(403);
  });

  it('gives the token to the laptop itself', async () => {
    const session = await (await fetch(`${base}/api/base/session`)).json();
    expect(session.token).toBe(store.token);
  });

  it('keeps the same token across restarts', () => {
    expect(new Store(dir).token).toBe(store.token);
  });
});

describe('find relay', () => {
  it('phone upload -> base judges -> phone sees the creature', async () => {
    const upload = { id: 'find-1', quest, photo: jpeg, createdAt: 5 };
    const sent = await fetch(`${base}/api/finds`, { method: 'POST', headers: paired(), body: JSON.stringify(upload) });
    expect(sent.status).toBe(201);
    // Retrying the same upload is harmless.
    await fetch(`${base}/api/finds`, { method: 'POST', headers: paired(), body: JSON.stringify(upload) });

    const jobs = await (await fetch(`${base}/api/base/checkin`, { method: 'POST', body: '{"gemmaReady":true}' })).json();
    expect(jobs.waiting.map((f: { id: string }) => f.id)).toEqual(['find-1']);

    const photo = await fetch(`${base}/api/finds/find-1/photo`);
    expect(Buffer.from(await photo.arrayBuffer()).toString()).toBe('fake jpeg');

    const creature = { id: 'c1', name: 'Rootlet' };
    await fetch(`${base}/api/finds/find-1/result`, {
      method: 'POST',
      body: JSON.stringify({ status: 'hatched', creature }),
    });

    const [find] = await (await fetch(`${base}/api/finds?ids=find-1`, { headers: paired() })).json();
    expect(find).toMatchObject({ status: 'hatched', creature: { name: 'Rootlet' } });

    const hello = await (await fetch(`${base}/api/hello`, { headers: paired() })).json();
    expect(hello).toMatchObject({ baseOnline: true, gemmaReady: true });
  });

  it('rejects uploads that are not JPEG data URLs', async () => {
    const bad = { id: 'find-2', quest, photo: 'data:text/html;base64,PGgxPg==', createdAt: 5 };
    const res = await fetch(`${base}/api/finds`, { method: 'POST', headers: paired(), body: JSON.stringify(bad) });
    expect(res.status).toBe(400);
  });

  it('hands out pre-written quests once each', async () => {
    await fetch(`${base}/api/quests`, { method: 'POST', body: JSON.stringify({ quest: FALLBACK_QUESTS[1] }) });
    const first = await fetch(`${base}/api/quests/next`, { method: 'POST', headers: paired() });
    expect((await first.json()).title).toBe(FALLBACK_QUESTS[1].title);
    expect((await fetch(`${base}/api/quests/next`, { method: 'POST', headers: paired() })).status).toBe(204);
  });
});
