// The hosted Side Quest: static app from dist/ (served without touching this code), plus /api/*.
// Gemma never runs here. This is only the mailbox between a player's phone and their laptop.
import { authRoutes, currentUser } from './auth';
import { mailboxRoutes } from './mailbox';
import { HttpError, json, type Env } from './http';

/** Cookies are Lax, but a same-origin check on every write is cheap insurance against CSRF. */
function sameOrigin(req: Request, url: URL): boolean {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  try {
    return new URL(req.headers.get('origin') ?? '').host === url.host;
  } catch {
    return false;
  }
}

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  if (!sameOrigin(req, url)) return json({ error: 'Wrong origin.' }, 403);
  const user = await currentUser(req, env);
  const auth = await authRoutes(req, env, url.pathname, user);
  if (auth) return auth;
  if (!user) return json({ error: 'Signed out.' }, 401);
  return (await mailboxRoutes(req, env, url, user)) ?? json({ error: 'Not found.' }, 404);
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
