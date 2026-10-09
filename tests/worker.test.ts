// Runs the real Worker from wrangler.jsonc in workerd, with local D1 and R2.
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createTestHarness } from 'wrangler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FALLBACK_QUESTS } from '../src/features/quests/fallbackQuests';
import type { QuestContext } from '../src/features/quests/questContext';
import type { Quest } from '../src/features/quests/questSchemas';

/** Just the bindings the tests touch. The Worker's own Env type needs the Workers lib, not the DOM one. */
interface TestEnv {
  APP_ORIGIN: string;
  DB: { prepare(sql: string): { bind(...args: unknown[]): { run(): Promise<unknown>; first(): Promise<unknown> } } };
  PHOTOS: { head(key: string): Promise<unknown> };
}

const harness = createTestHarness({ root: join(import.meta.dirname, '..'), workers: [{ configPath: 'wrangler.jsonc' }] });
let env: TestEnv;
/** Whatever the config (or .dev.vars) says the site is. Writes must come from here. */
let ORIGIN: string;

const quest: Quest = { ...FALLBACK_QUESTS[0], id: 'q1', source: 'library', status: 'active', createdAt: 1 };
const jpegBytes = Buffer.from('pretend jpeg bytes');
const jpeg = `data:image/jpeg;base64,${jpegBytes.toString('base64')}`;
const park: QuestContext = { setting: 'park', weather: 'sunny', season: 'autumn', time: 'morning' };
const beach: QuestContext = { ...park, setting: 'beach' };
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

beforeAll(async () => {
  await harness.listen();
  const worker = harness.getWorker();
  await worker.applyD1Migrations('DB');
  env = (await worker.getEnv()) as TestEnv;
  ORIGIN = env.APP_ORIGIN;
}, 60_000);

afterAll(() => harness.close());

/** A user with a live session, as if they'd just come back from GitHub. */
async function signUp(expiresAt = Date.now() + 60_000) {
  const id = randomUUID();
  const token = randomUUID();
  await env.DB
    .prepare('INSERT INTO users (id, github_id, login, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, Math.floor(Math.random() * 1e9), `player-${id.slice(0, 6)}`, Date.now())
    .run();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(sha(token), id, expiresAt).run();
  return { id, cookie: `sq_session=${token}` };
}

function call(path: string, cookie: string | null, init: { method?: string; body?: unknown; origin?: string } = {}) {
  const headers: Record<string, string> = { origin: init.origin ?? ORIGIN };
  if (cookie) headers.cookie = cookie;
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  return harness.fetch(`${ORIGIN}${path}`, {
    method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/** Response JSON, loosely typed: these tests check shapes with expect. */
const body = async (res: Promise<{ json(): Promise<unknown> }>): Promise<any> => (await res).json();

const upload = (cookie: string, id = randomUUID()) =>
  call('/api/finds', cookie, { body: { id, quest, photo: jpeg, createdAt: Date.now() } });

describe('hosted API security', () => {
  it('turns away signed-out requests', async () => {
    expect((await call('/api/hello', null)).status).toBe(401);
    expect((await call('/api/me', null)).status).toBe(401);
    expect((await call('/api/base/checkin', null, { body: {} })).status).toBe(401);
  });

  it('refuses writes from another origin', async () => {
    const { cookie } = await signUp();
    expect((await call('/api/base/checkin', cookie, { body: {}, origin: 'https://evil.test' })).status).toBe(403);
  });

  it('treats an expired session as signed out', async () => {
    const { cookie } = await signUp(Date.now() - 1);
    expect((await call('/api/me', cookie)).status).toBe(401);
  });

  it("never shows one player's finds or photos to another", async () => {
    const alice = await signUp();
    const bob = await signUp();
    const id = randomUUID();
    expect((await upload(alice.cookie, id)).status).toBe(201);

    expect(await body(call(`/api/finds?ids=${id}`, bob.cookie))).toEqual([]);
    expect((await call(`/api/finds/${id}/photo`, bob.cookie)).status).toBe(404);
    expect((await call(`/api/finds/${id}/result`, bob.cookie, { body: { status: 'confused' } })).status).toBe(404);
    const jobs = await body(call('/api/base/checkin', bob.cookie, { body: { gemmaReady: true } }));
    expect(jobs.waiting).toEqual([]);
  });
});

describe('find relay', () => {
  it('phone upload -> laptop judges -> phone sees the creature', async () => {
    const { cookie } = await signUp();
    const id = randomUUID();
    await upload(cookie, id);
    expect((await upload(cookie, id)).status).toBe(201); // retries are harmless

    const jobs = await body(call('/api/base/checkin', cookie, { body: { gemmaReady: true } }));
    expect(jobs.waiting.map((f: { id: string }) => f.id)).toEqual([id]);

    const photo = await call(`/api/finds/${id}/photo`, cookie);
    expect(Buffer.from(await photo.arrayBuffer())).toEqual(jpegBytes);

    const creature = { id: 'c1', name: 'Mossling' };
    const resolved = await call(`/api/finds/${id}/result`, cookie, { body: { status: 'hatched', creature } });
    expect(resolved.status).toBe(200);

    const [find] = await body(call(`/api/finds?ids=${id}`, cookie));
    expect(find).toMatchObject({ id, status: 'hatched', creature });
    const hello = await body(call('/api/hello', cookie));
    expect(hello).toMatchObject({ baseOnline: true, gemmaReady: true });
  });

  it('rejects a find that is not a JPEG', async () => {
    const { cookie } = await signUp();
    const bad = await call('/api/finds', cookie, { body: { id: 'x', quest, photo: 'data:image/png;base64,AAAA', createdAt: 1 } });
    expect(bad.status).toBe(400);
  });
});

describe('quest pool', () => {
  it('hands out quests written for where the phone is, and drops them when it moves', async () => {
    const { cookie } = await signUp();
    const draft = { title: 'Find a red leaf', description: 'Any red leaf counts.' };
    expect((await call('/api/quests/next', cookie, { body: { context: park } })).status).toBe(204);

    await call('/api/quests', cookie, { body: { quest: draft, context: park } });
    await call('/api/quests', cookie, { body: { quest: draft, context: park } }); // same title, skipped
    await call('/api/quests', cookie, { body: { quest: { ...draft, title: 'Old one' }, context: beach } }); // stale, skipped
    let jobs = await body(call('/api/base/checkin', cookie, { body: {} }));
    expect(jobs.questsReady).toBe(1);
    expect(jobs.context).toEqual(park);

    await call('/api/quests', cookie, { body: { quest: { ...draft, title: 'Second' }, context: park } });
    expect(await body(call('/api/quests/next', cookie, { body: { context: park } }))).toEqual(draft);

    // Phone moved to the beach: whatever was left for the park is gone.
    expect((await call('/api/quests/next', cookie, { body: { context: beach } })).status).toBe(204);
    jobs = await body(call('/api/base/checkin', cookie, { body: {} }));
    expect(jobs.questsReady).toBe(0);
  });
});

describe('phone sign-in by QR', () => {
  it('a code signs the phone into the same account, once', async () => {
    const laptop = await signUp();
    const { url } = await body(call('/api/link-codes', laptop.cookie, { body: {} }));
    const code = new URL(url).hash.replace('#code=', '');

    const redeemed = await call('/api/link', null, { body: { code } });
    expect(redeemed.status).toBe(204);
    const phoneCookie = redeemed.headers.get('set-cookie')!.split(';')[0];
    expect((await body(call('/api/me', phoneCookie))).id).toBe(laptop.id);

    expect((await call('/api/link', null, { body: { code } })).status).toBe(410);
  });

  it('refuses an expired code', async () => {
    const { id } = await signUp();
    await env.DB.prepare('INSERT INTO link_codes (code_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(sha('old'), id, Date.now() - 1).run();
    expect((await call('/api/link', null, { body: { code: 'old' } })).status).toBe(410);
  });
});

describe('account deletion', () => {
  it('removes photos, rows, and every session', async () => {
    const { id, cookie } = await signUp();
    const findId = randomUUID();
    await upload(cookie, findId);
    const photos = env.PHOTOS;
    expect(await photos.head(`${id}/finds/${findId}.jpg`)).not.toBeNull();

    expect((await call('/api/account/delete', cookie, { body: {} })).status).toBe(204);
    expect(await photos.head(`${id}/finds/${findId}.jpg`)).toBeNull();
    expect((await call('/api/me', cookie)).status).toBe(401);
    for (const table of ['users', 'finds', 'sessions']) {
      const col = table === 'users' ? 'id' : 'user_id';
      expect(await env.DB.prepare(`SELECT 1 FROM ${table} WHERE ${col} = ?`).bind(id).first()).toBeNull();
    }
  });
});
