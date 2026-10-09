// The hosted version of server/app.ts + server/store.ts: same paths, same rules, but every
// row and photo belongs to the signed-in user instead of one machine.
import type {
  BaseCheckIn,
  BaseJobs,
  Find,
  FindResult,
  FindUpload,
  HelloResponse,
  HuntResult,
  HuntSubmission,
  HuntUpload,
} from '../src/lib/home/protocol';
import type { HuntDraft } from '../src/features/hunts/huntSchemas';
import type { QuestDraft } from '../src/features/quests/questSchemas';
import { contextKey, isQuestContext, type QuestContext } from '../src/features/quests/questContext';
import type { User } from './auth';
import { HttpError, SAFE_ID, empty, json, jpegBytes, readJson, readJsonOr, type Env } from './http';

/** The laptop checks in every 4 s while busy and every 20 s while idle, so allow for the slow beat. */
const BASE_ONLINE_MS = 45_000;
const QUESTS_WANTED = 3;
const HUNTS_WANTED = 1;
const MAX_HUNT_ITEMS = 12;
/** Most finds a single status check or check-in hands back. */
const PAGE = 50;

type Kind = 'quest' | 'hunt';

const findKey = (uid: string, id: string) => `${uid}/finds/${id}.jpg`;
const huntKey = (uid: string, huntId: string, itemId: string) => `${uid}/hunts/${huntId}/${itemId}.jpg`;

interface FindRow {
  id: string;
  quest: string;
  status: Find['status'];
  creature: string | null;
  reason: string | null;
  created_at: number;
  resolved_at: number | null;
}

interface HuntRow {
  id: string;
  title: string;
  items: string;
  status: HuntSubmission['status'];
  result: string | null;
  created_at: number;
  resolved_at: number | null;
}

const toFind = (r: FindRow): Find => ({
  id: r.id,
  quest: JSON.parse(r.quest),
  createdAt: r.created_at,
  status: r.status,
  ...(r.creature && { creature: JSON.parse(r.creature) }),
  ...(r.reason && { reason: r.reason }),
  ...(r.resolved_at && { resolvedAt: r.resolved_at }),
});

const toHunt = (r: HuntRow): HuntSubmission => ({
  id: r.id,
  title: r.title,
  createdAt: r.created_at,
  items: JSON.parse(r.items),
  status: r.status,
  ...(r.result && { result: JSON.parse(r.result) }),
  ...(r.resolved_at && { resolvedAt: r.resolved_at }),
});

/** `?ids=a,b,c` -> at most PAGE safe ids. */
const idsFrom = (url: URL) =>
  (url.searchParams.get('ids') ?? '')
    .split(',')
    .filter((id) => SAFE_ID.test(id))
    .slice(0, PAGE);

class Mailbox {
  constructor(
    private readonly env: Env,
    private readonly uid: string,
  ) {}

  private get db() {
    return this.env.DB;
  }

  // --- state -----------------------------------------------------------------------

  async state(): Promise<{ context: QuestContext | null; baseSeenAt: number; gemmaReady: boolean }> {
    const row = await this.db
      .prepare('SELECT context, base_seen_at, gemma_ready FROM user_state WHERE user_id = ?')
      .bind(this.uid)
      .first<{ context: string | null; base_seen_at: number; gemma_ready: number }>();
    const context = row?.context ? JSON.parse(row.context) : null;
    return {
      // A context saved before a setting was renamed would give Gemma a broken prompt.
      context: isQuestContext(context) ? context : null,
      baseSeenAt: row?.base_seen_at ?? 0,
      gemmaReady: !!row?.gemma_ready,
    };
  }

  async checkIn(gemmaReady: boolean): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO user_state (user_id, base_seen_at, gemma_ready) VALUES (?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET base_seen_at = excluded.base_seen_at, gemma_ready = excluded.gemma_ready`,
      )
      .bind(this.uid, Date.now(), gemmaReady ? 1 : 0)
      .run();
  }

  /** New context from the phone. Quests and hunts written for a different one are dropped. */
  async setContext(context: QuestContext): Promise<void> {
    const { context: current } = await this.state();
    if (current && contextKey(current) === contextKey(context)) return;
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO user_state (user_id, context) VALUES (?, ?)
           ON CONFLICT (user_id) DO UPDATE SET context = excluded.context`,
        )
        .bind(this.uid, JSON.stringify(context)),
      this.db.prepare('DELETE FROM pool WHERE user_id = ?').bind(this.uid),
    ]);
  }

  // --- the pool of pre-written quests and hunts -------------------------------------

  async ready(kind: Kind): Promise<number> {
    const row = await this.db
      .prepare('SELECT COUNT(*) AS n FROM pool WHERE user_id = ? AND kind = ?')
      .bind(this.uid, kind)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  /** Skips drafts written for a context the phone has since left behind, and repeat quest titles. */
  async addDraft(kind: Kind, draft: QuestDraft | HuntDraft, writtenFor: QuestContext | null): Promise<void> {
    const { context } = await this.state();
    if (context && (!writtenFor || contextKey(writtenFor) !== contextKey(context))) return;
    const title = draft.title.slice(0, 120);
    if (kind === 'quest') {
      const dupe = await this.db
        .prepare("SELECT 1 FROM pool WHERE user_id = ? AND kind = 'quest' AND title = ?")
        .bind(this.uid, title)
        .first();
      if (dupe) return;
    }
    await this.db
      .prepare('INSERT INTO pool (user_id, kind, title, draft) VALUES (?, ?, ?, ?)')
      .bind(this.uid, kind, title, JSON.stringify(draft))
      .run();
  }

  /** Oldest draft first. One statement, so two phones can't get the same one. */
  async take<T>(kind: Kind): Promise<T | null> {
    const row = await this.db
      .prepare(
        `DELETE FROM pool WHERE seq = (SELECT seq FROM pool WHERE user_id = ? AND kind = ? ORDER BY seq LIMIT 1)
         RETURNING draft`,
      )
      .bind(this.uid, kind)
      .first<{ draft: string }>();
    return row ? (JSON.parse(row.draft) as T) : null;
  }

  // --- finds -----------------------------------------------------------------------

  async getFind(id: string): Promise<Find | null> {
    const row = await this.db.prepare('SELECT * FROM finds WHERE user_id = ? AND id = ?').bind(this.uid, id).first<FindRow>();
    return row ? toFind(row) : null;
  }

  async finds(ids: string[]): Promise<Find[]> {
    if (!ids.length) return [];
    const marks = ids.map(() => '?').join(',');
    const { results } = await this.db
      .prepare(`SELECT * FROM finds WHERE user_id = ? AND id IN (${marks})`)
      .bind(this.uid, ...ids)
      .all<FindRow>();
    return results.map(toFind);
  }

  async waitingFinds(): Promise<Find[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM finds WHERE user_id = ? AND status = 'waiting' ORDER BY created_at LIMIT ?")
      .bind(this.uid, PAGE)
      .all<FindRow>();
    return results.map(toFind);
  }

  /** Idempotent: the phone retries uploads. Photo first, so the laptop never sees a row without one. */
  async addFind(upload: FindUpload, jpeg: Uint8Array): Promise<Find> {
    const existing = await this.getFind(upload.id);
    if (existing) return existing;
    await this.env.PHOTOS.put(findKey(this.uid, upload.id), jpeg, { httpMetadata: { contentType: 'image/jpeg' } });
    const createdAt = Number(upload.createdAt) || Date.now();
    await this.db
      .prepare("INSERT OR IGNORE INTO finds (user_id, id, quest, status, created_at) VALUES (?, ?, ?, 'waiting', ?)")
      .bind(this.uid, upload.id, JSON.stringify(upload.quest), createdAt)
      .run();
    return (await this.getFind(upload.id))!;
  }

  async resolveFind(id: string, result: FindResult): Promise<Find | null> {
    const row = await this.db
      .prepare(
        `UPDATE finds SET status = ?, creature = ?, reason = ?, resolved_at = ? WHERE user_id = ? AND id = ?
         RETURNING *`,
      )
      .bind(
        result.status,
        result.creature ? JSON.stringify(result.creature) : null,
        typeof result.reason === 'string' ? result.reason.slice(0, 300) : null,
        Date.now(),
        this.uid,
        id,
      )
      .first<FindRow>();
    return row ? toFind(row) : null;
  }

  // --- hunts -----------------------------------------------------------------------

  async getHunt(id: string): Promise<HuntSubmission | null> {
    const row = await this.db.prepare('SELECT * FROM hunts WHERE user_id = ? AND id = ?').bind(this.uid, id).first<HuntRow>();
    return row ? toHunt(row) : null;
  }

  async hunts(ids: string[]): Promise<HuntSubmission[]> {
    if (!ids.length) return [];
    const marks = ids.map(() => '?').join(',');
    const { results } = await this.db
      .prepare(`SELECT * FROM hunts WHERE user_id = ? AND id IN (${marks})`)
      .bind(this.uid, ...ids)
      .all<HuntRow>();
    return results.map(toHunt);
  }

  async waitingHunts(): Promise<HuntSubmission[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM hunts WHERE user_id = ? AND status = 'waiting' ORDER BY created_at LIMIT ?")
      .bind(this.uid, PAGE)
      .all<HuntRow>();
    return results.map(toHunt);
  }

  /** Idempotent like addFind. */
  async addHunt(hunt: HuntSubmission, photos: Map<string, Uint8Array>): Promise<HuntSubmission> {
    const existing = await this.getHunt(hunt.id);
    if (existing) return existing;
    await Promise.all(
      [...photos].map(([itemId, jpeg]) =>
        this.env.PHOTOS.put(huntKey(this.uid, hunt.id, itemId), jpeg, { httpMetadata: { contentType: 'image/jpeg' } }),
      ),
    );
    await this.db
      .prepare("INSERT OR IGNORE INTO hunts (user_id, id, title, items, status, created_at) VALUES (?, ?, ?, ?, 'waiting', ?)")
      .bind(this.uid, hunt.id, hunt.title, JSON.stringify(hunt.items), hunt.createdAt)
      .run();
    return (await this.getHunt(hunt.id))!;
  }

  async resolveHunt(id: string, result: HuntResult): Promise<HuntSubmission | null> {
    const row = await this.db
      .prepare("UPDATE hunts SET status = 'done', result = ?, resolved_at = ? WHERE user_id = ? AND id = ? RETURNING *")
      .bind(JSON.stringify(result), Date.now(), this.uid, id)
      .first<HuntRow>();
    return row ? toHunt(row) : null;
  }

  async photo(key: string): Promise<Response> {
    const object = await this.env.PHOTOS.get(key);
    if (!object) return empty(404);
    return new Response(object.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, no-store' } });
  }
}

/** Mailbox routes for a signed-in user. Returns null when the path isn't one of them. */
export async function mailboxRoutes(req: Request, env: Env, url: URL, user: User): Promise<Response | null> {
  const box = new Mailbox(env, user.id);
  const path = url.pathname;
  const method = req.method;
  let m: RegExpExecArray | null;

  // --- base: the laptop tab running Gemma ---------------------------------------------
  if (path === '/api/base/checkin' && method === 'POST') {
    const body = await readJsonOr<Partial<BaseCheckIn>>(req, {});
    await box.checkIn(!!body.gemmaReady);
    const [waiting, questsReady, huntsWaiting, huntsReady, { context }] = await Promise.all([
      box.waitingFinds(),
      box.ready('quest'),
      box.waitingHunts(),
      box.ready('hunt'),
      box.state(),
    ]);
    return json({
      waiting,
      questsReady,
      questsWanted: QUESTS_WANTED,
      huntsWaiting,
      huntsReady,
      huntsWanted: HUNTS_WANTED,
      context,
    } satisfies BaseJobs);
  }
  if (path === '/api/quests' && method === 'POST') {
    const body = await readJson<{ quest?: QuestDraft; context?: unknown }>(req);
    if (typeof body.quest?.title !== 'string') throw new HttpError(400, 'Bad quest.');
    await box.addDraft('quest', body.quest, isQuestContext(body.context) ? body.context : null);
    return empty();
  }
  if (path === '/api/base/hunt-pool' && method === 'POST') {
    const body = await readJson<{ hunt?: HuntDraft; context?: unknown }>(req);
    if (typeof body.hunt?.title !== 'string' || !Array.isArray(body.hunt.items)) throw new HttpError(400, 'Bad hunt.');
    await box.addDraft('hunt', body.hunt, isQuestContext(body.context) ? body.context : null);
    return empty();
  }
  if ((m = /^\/api\/finds\/([\w-]+)\/photo$/.exec(path)) && method === 'GET') {
    return box.photo(findKey(user.id, m[1]));
  }
  if ((m = /^\/api\/finds\/([\w-]+)\/result$/.exec(path)) && method === 'POST') {
    const result = await readJson<FindResult>(req);
    if (!['hatched', 'not-quite', 'confused'].includes(result.status)) throw new HttpError(400, 'Bad result.');
    const find = await box.resolveFind(m[1], result);
    return find ? json(find) : empty(404);
  }
  if ((m = /^\/api\/base\/hunts\/([\w-]+)\/photo\/([\w-]+)$/.exec(path)) && method === 'GET') {
    return box.photo(huntKey(user.id, m[1], m[2]));
  }
  if ((m = /^\/api\/base\/hunts\/([\w-]+)\/result$/.exec(path)) && method === 'POST') {
    const result = await readJson<HuntResult>(req);
    if (!Array.isArray(result.items)) throw new HttpError(400, 'Bad result.');
    const hunt = await box.resolveHunt(m[1], result);
    return hunt ? json(hunt) : empty(404);
  }

  // --- field: the phone ------------------------------------------------------------
  if (path === '/api/hello' && method === 'GET') {
    const [{ baseSeenAt, gemmaReady }, questsReady] = await Promise.all([box.state(), box.ready('quest')]);
    const baseOnline = Date.now() - baseSeenAt < BASE_ONLINE_MS;
    return json({ app: 'side-quest-home', baseOnline, gemmaReady: baseOnline && gemmaReady, questsReady } satisfies HelloResponse);
  }
  if ((path === '/api/quests/next' || path === '/api/hunts/next') && method === 'POST') {
    const { context } = await readJsonOr<{ context?: unknown }>(req, {});
    if (isQuestContext(context)) await box.setContext(context);
    const draft = await box.take(path === '/api/quests/next' ? 'quest' : 'hunt');
    return draft ? json(draft) : empty();
  }
  if (path === '/api/finds' && method === 'POST') {
    const upload = await readJson<FindUpload>(req);
    const jpeg = jpegBytes(upload.photo);
    if (!jpeg || !SAFE_ID.test(upload.id ?? '') || typeof upload.quest?.title !== 'string') throw new HttpError(400, 'Bad find.');
    return json(await box.addFind(upload, jpeg), 201);
  }
  if (path === '/api/finds' && method === 'GET') return json(await box.finds(idsFrom(url)));
  if (path === '/api/hunts' && method === 'POST') {
    const upload = await readJson<HuntUpload>(req);
    const items = Array.isArray(upload.items) ? upload.items : [];
    const photos = new Map<string, Uint8Array>();
    for (const item of items) {
      const jpeg = jpegBytes(item?.photo);
      if (!jpeg || !SAFE_ID.test(item.id ?? '') || typeof item.text !== 'string') break;
      photos.set(item.id, jpeg);
    }
    const valid = SAFE_ID.test(upload.id ?? '') && typeof upload.title === 'string' && items.length > 0;
    if (!valid || items.length > MAX_HUNT_ITEMS || photos.size !== items.length) throw new HttpError(400, 'Bad hunt.');
    const hunt = await box.addHunt(
      {
        id: upload.id,
        title: upload.title.slice(0, 60),
        createdAt: Number(upload.createdAt) || Date.now(),
        items: items.map(({ id, text }) => ({ id, text: text.slice(0, 80) })),
        status: 'waiting',
      },
      photos,
    );
    return json(hunt, 201);
  }
  if (path === '/api/hunts' && method === 'GET') return json(await box.hunts(idsFrom(url)));
  return null;
}
