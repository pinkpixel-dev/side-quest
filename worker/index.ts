// The hosted Side Quest: static app from dist/ (served without touching this code), plus /api/*.
// Gemma never runs here. This is only the mailbox between a player's phone and their laptop.
import { authRoutes, currentUser } from './auth';
import { collectionRoutes } from './collection';
import { mailboxRoutes } from './mailbox';
import { HttpError, json, type Env } from './http';

/**
 * Cookies are Lax, but a same-origin check on every write is cheap insurance against CSRF.
 * The site's own host counts, and so does APP_ORIGIN: in dev the Vite proxy forwards
 * localhost:5173 requests to wrangler on :8787, so the two don't match there.
 */
function sameOrigin(req: Request, env: Env, url: URL): boolean {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  try {
    const origin = new URL(req.headers.get('origin') ?? '');
    return origin.host === url.host || origin.origin === env.APP_ORIGIN;
  } catch {
    return false;
  }
}

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  if (!sameOrigin(req, env, url)) return json({ error: 'Wrong origin.' }, 403);
  const user = await currentUser(req, env);
  const auth = await authRoutes(req, env, url.pathname, user);
  if (auth) return auth;
  if (!user) return json({ error: 'Signed out.' }, 401);
  return (
    (await mailboxRoutes(req, env, url, user)) ??
    (await collectionRoutes(req, env, url.pathname, user)) ??
    json({ error: 'Not found.' }, 404)
  );
}

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return await api(req, env, url);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error('API error', url.pathname, err);
      return json({ error: 'Something went wrong.' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
