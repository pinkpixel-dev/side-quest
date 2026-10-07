import { timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import type {
  BaseCheckIn,
  BaseJobs,
  BaseSession,
  Find,
  FindResult,
  FindUpload,
  HelloResponse,
} from '../src/lib/home/protocol.ts';
import type { Store } from './store.ts';

export interface HomeOptions {
  store: Store;
  /** Built app to serve (dist/). Optional so tests can run the API alone. */
  staticDir?: string;
  /** Filled in once the tunnel is up. */
  session: () => Omit<BaseSession, 'token'>;
}

const MAX_BODY = 8 * 1024 * 1024;
const BASE_ONLINE_MS = 20_000;
const QUESTS_WANTED = 3;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

/**
 * Anything that came through cloudflared carries Cloudflare's headers. Requests without
 * them can only come from this machine (the server binds to 127.0.0.1).
 */
export function isLocal(req: IncomingMessage): boolean {
  return !req.headers['cf-ray'] && !req.headers['cf-connecting-ip'];
}

function hasToken(req: IncomingMessage, token: string): boolean {
  const given = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

function send(res: ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw Object.assign(new Error('Too large'), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

export function createHomeServer({ store, staticDir, session }: HomeOptions): Server {
  let baseSeenAt = 0;
  let gemmaReady = false;

  const api = async (req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> => {
    const local = isLocal(req);
    const path = url.pathname;
    const method = req.method ?? 'GET';

    // --- base (laptop only) --------------------------------------------------------
    if (path.startsWith('/api/base/') || /^\/api\/finds\/[\w-]+\/(photo|result)$/.test(path) || (path === '/api/quests' && method === 'POST')) {
      if (!local) return send(res, 403, { error: 'Base endpoints are only available on the home computer.' });

      if (path === '/api/base/session' && method === 'GET') {
        return send(res, 200, { token: store.token, ...session() } satisfies BaseSession);
      }
      if (path === '/api/base/checkin' && method === 'POST') {
        const body = await readJson<BaseCheckIn>(req);
        baseSeenAt = Date.now();
        gemmaReady = !!body.gemmaReady;
        return send(res, 200, {
          waiting: store.waitingFinds(),
          questsReady: store.questsReady,
          questsWanted: QUESTS_WANTED,
        } satisfies BaseJobs);
      }
      if (path === '/api/quests' && method === 'POST') {
        store.addQuest((await readJson<{ quest: Find['quest'] }>(req)).quest);
        return send(res, 204);
      }
      const findId = path.split('/')[3];
      if (path.endsWith('/photo') && method === 'GET') {
        const file = store.photoPath(findId);
        if (!existsSync(file)) return send(res, 404);
        res.writeHead(200, { 'content-type': 'image/jpeg' });
        return void createReadStream(file).pipe(res);
      }
      if (path.endsWith('/result') && method === 'POST') {
        const result = await readJson<FindResult>(req);
        const find = store.resolveFind(findId, result);
        return find ? send(res, 200, find) : send(res, 404);
      }
      return send(res, 404);
    }

    // --- field (the phone, through the tunnel) -------------------------------------
    if (!hasToken(req, store.token)) return send(res, 401, { error: 'Not paired.' });

    if (path === '/api/hello' && method === 'GET') {
      return send(res, 200, {
        app: 'side-quest-home',
        baseOnline: Date.now() - baseSeenAt < BASE_ONLINE_MS,
        gemmaReady,
        questsReady: store.questsReady,
      } satisfies HelloResponse);
    }
    if (path === '/api/quests/next' && method === 'POST') {
      const quest = store.takeQuest();
      return quest ? send(res, 200, quest) : send(res, 204);
    }
    if (path === '/api/finds' && method === 'POST') {
      const upload = await readJson<FindUpload>(req);
      const match = /^data:image\/jpeg;base64,(.+)$/.exec(upload.photo ?? '');
      if (!match || !/^[\w-]+$/.test(upload.id ?? '') || !upload.quest?.title) return send(res, 400, { error: 'Bad find.' });
      store.addFind(
        { id: upload.id, quest: upload.quest, createdAt: upload.createdAt, status: 'waiting' },
        Buffer.from(match[1], 'base64'),
      );
      return send(res, 201, store.getFind(upload.id));
    }
    if (path === '/api/finds' && method === 'GET') {
      const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 50);
      return send(res, 200, ids.map((id) => store.getFind(id)).filter(Boolean));
    }
    return send(res, 404);
  };

  const serveStatic = (res: ServerResponse, pathname: string) => {
    if (!staticDir) return send(res, 404);
    const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    let file = join(staticDir, safe);
    if (!file.startsWith(staticDir) || !existsSync(file) || statSync(file).isDirectory()) {
      // A missing file (stale chunk, typo) is a real 404. Only extension-less app routes
      // like /quest or /pair fall back to the app shell.
      if (extname(safe)) return send(res, 404);
      file = join(staticDir, 'index.html');
      if (!existsSync(file)) return send(res, 404, { error: 'Build the app first: npm run build' });
    }
    const immutable = safe.startsWith('/assets/');
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(readFileSync(file));
  };

  return createServer(async (req, res) => {
    // The phone app may be served from another origin (the deployed site). Auth is a
    // bearer token, not cookies, so a wildcard origin is safe here.
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'authorization, content-type');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return send(res, 204);

    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else serveStatic(res, url.pathname);
    } catch (err) {
      const status = (err as { status?: number }).status ?? 400;
      if (!res.headersSent) send(res, status, { error: (err as Error).message });
    }
  });
}
