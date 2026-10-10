import { HttpError, cookie, empty, json, randomToken, readCookie, readJson, sha256, type Env } from './http';

export interface User {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

const SESSION_COOKIE = 'sq_session';
const STATE_COOKIE = 'sq_oauth';
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const STATE_SECONDS = 600;
/** Long enough to point a phone at the screen, short enough that a photo of it is useless later. */
export const LINK_CODE_MS = 2 * 60 * 1000;

const callbackUrl = (env: Env) => `${env.APP_ORIGIN}/api/auth/callback`;
const redirect = (to: string, headers: HeadersInit = {}) => new Response(null, { status: 302, headers: { location: to, ...headers } });

/** The signed-in user for this request, or null. Expired sessions are cleaned up on the way. */
export async function currentUser(req: Request, env: Env): Promise<User | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const hash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.login, u.name, u.avatar_url AS avatarUrl, s.expires_at AS expiresAt
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
  )
    .bind(hash)
    .first<User & { expiresAt: number }>();
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
    return null;
  }
  const { expiresAt: _, ...user } = row;
  return user;
}

/** A fresh session for this device. Returns the Set-Cookie header value. */
async function startSession(env: Env, userId: string): Promise<string> {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, Date.now() + SESSION_MS)
    .run();
  return cookie(env, SESSION_COOKIE, token, SESSION_DAYS * 24 * 60 * 60);
}

function startGithub(env: Env): Response {
  if (!env.GITHUB_CLIENT_ID) throw new HttpError(500, 'GitHub sign-in is not set up.');
  const state = randomToken(16);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', callbackUrl(env));
  url.searchParams.set('state', state);
  // No scope: we only read the public profile.
  url.searchParams.set('allow_signup', 'true');
  return redirect(url.toString(), { 'set-cookie': cookie(env, STATE_COOKIE, state, STATE_SECONDS, '/api/auth') });
}

interface GithubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
}

async function finishGithub(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const clearState = cookie(env, STATE_COOKIE, '', 0, '/api/auth');
  const failed = () => redirect('/account?signin=failed', { 'set-cookie': clearState });
  if (!code || !state || state !== readCookie(req, STATE_COOKIE)) return failed();

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl(env),
    }),
  });
  const { access_token } = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
  if (!access_token) return failed();

  const userRes = await fetch('https://api.github.com/user', {
    headers: { authorization: `Bearer ${access_token}`, accept: 'application/vnd.github+json', 'user-agent': 'side-quest' },
  });
  if (!userRes.ok) return failed();
  const gh = (await userRes.json()) as GithubUser;

  // The GitHub token is only needed for that one profile read, so it's never stored.
  const user = await env.DB.prepare(
    `INSERT INTO users (id, github_id, login, name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (github_id) DO UPDATE SET login = excluded.login, name = excluded.name, avatar_url = excluded.avatar_url
     RETURNING id`,
  )
    .bind(crypto.randomUUID(), gh.id, gh.login, gh.name, gh.avatar_url, Date.now())
    .first<{ id: string }>();
  if (!user) return failed();

  const headers = new Headers({ location: '/base' });
  headers.append('set-cookie', clearState);
  headers.append('set-cookie', await startSession(env, user.id));
  return new Response(null, { status: 302, headers });
}

/** Laptop: a one-time code for the phone's QR. Only the hash is kept. */
async function createLinkCode(env: Env, user: User): Promise<Response> {
  const code = randomToken(18);
  const expiresAt = Date.now() + LINK_CODE_MS;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM link_codes WHERE expires_at < ?').bind(Date.now()),
    env.DB.prepare('INSERT INTO link_codes (code_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(code), user.id, expiresAt),
  ]);
  return json({ url: `${env.APP_ORIGIN}/link#code=${code}`, expiresAt });
}

/** Phone: trade the code for a session. Deleting with RETURNING makes it single-use, even under a race. */
async function redeemLinkCode(req: Request, env: Env): Promise<Response> {
  const { code } = await readJson<{ code?: unknown }>(req);
  if (typeof code !== 'string' || !code) throw new HttpError(400, 'Missing code.');
  const row = await env.DB.prepare('DELETE FROM link_codes WHERE code_hash = ? RETURNING user_id AS userId, expires_at AS expiresAt')
    .bind(await sha256(code))
    .first<{ userId: string; expiresAt: number }>();
  if (!row || row.expiresAt < Date.now()) throw new HttpError(410, 'That code expired. Make a new one on your computer.');
  return empty(204, { 'set-cookie': await startSession(env, row.userId) });
}

async function signOut(req: Request, env: Env): Promise<Response> {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return empty(204, { 'set-cookie': cookie(env, SESSION_COOKIE, '', 0) });
}

/** Every photo under the user's prefix, then every row. Signs out all their devices. */
export async function deleteAccount(env: Env, user: User): Promise<Response> {
  let cursor: string | undefined;
  do {
    const page = await env.PHOTOS.list({ prefix: `${user.id}/`, cursor, limit: 1000 });
    if (page.objects.length) await env.PHOTOS.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const tables = ['sessions', 'link_codes', 'finds', 'hunts', 'pool', 'user_state', 'creatures'];
  await env.DB.batch([
    ...tables.map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(user.id)),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);
  return empty(204, { 'set-cookie': cookie(env, SESSION_COOKIE, '', 0) });
}

/** Account routes. Returns null when the path isn't one of them. */
export async function authRoutes(req: Request, env: Env, path: string, user: User | null): Promise<Response | null> {
  const method = req.method;
  if (path === '/api/auth/github' && method === 'GET') return startGithub(env);
  if (path === '/api/auth/callback' && method === 'GET') return finishGithub(req, env);
  if (path === '/api/auth/logout' && method === 'POST') return signOut(req, env);
  if (path === '/api/link' && method === 'POST') return redeemLinkCode(req, env);
  if (path === '/api/me' && method === 'GET') return user ? json(user) : json({ error: 'Signed out.' }, 401);
  if (path === '/api/link-codes' && method === 'POST') return user ? createLinkCode(env, user) : json({ error: 'Signed out.' }, 401);
  if (path === '/api/account/delete' && method === 'POST') return user ? deleteAccount(env, user) : json({ error: 'Signed out.' }, 401);
  return null;
}
