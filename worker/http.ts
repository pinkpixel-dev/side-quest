export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PHOTOS: R2Bucket;
  /** e.g. https://side-quest.pinkpixel.dev, or http://localhost:5173 in dev. */
  APP_ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

// A full hunt is ten photos in one request. Same limit as the home server.
export const MAX_BODY = 16 * 1024 * 1024;
export const SAFE_ID = /^[\w-]+$/;
const JPEG_DATA_URL = /^data:image\/jpeg;base64,(.+)$/;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });

export const empty = (status = 204, headers: HeadersInit = {}) => new Response(null, { status, headers });

export async function readJson<T>(req: Request): Promise<T> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) throw new HttpError(413, 'Too large');
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'Too large');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Bad JSON');
  }
}

/** Older phones send no body with some POSTs. That's fine, they just get the defaults. */
export async function readJsonOr<T>(req: Request, fallback: T): Promise<T> {
  return readJson<T>(req).catch(() => fallback);
}

/** The JPEG bytes out of a `data:image/jpeg;base64,…` URL, or null if it isn't one. */
export function jpegBytes(dataUrl: unknown): Uint8Array | null {
  const match = typeof dataUrl === 'string' ? JPEG_DATA_URL.exec(dataUrl) : null;
  if (!match) return null;
  try {
    const binary = atob(match[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}

/** HttpOnly, Lax, and Secure whenever the site is on https (plain http only happens in local dev). */
export function cookie(env: Env, name: string, value: string, maxAge: number, path = '/'): string {
  const secure = env.APP_ORIGIN.startsWith('https://') ? '; Secure' : '';
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
