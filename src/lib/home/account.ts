// Signed-in play on the hosted site. Same account on both devices: the laptop runs Gemma
// (home base), the phone goes outside (field). The site's /api is the mailbox between them.
import { getSetting, setSetting } from '../db/database';
import type { Pairing } from './client';

export interface AccountUser {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

/** What this device does for the account. Picked at sign-in, switchable on the account page. */
export type DeviceRole = 'base' | 'field';

export interface Account {
  user: AccountUser;
  role: DeviceRole;
}

const ACCOUNT_KEY = 'account';

/** Kept locally so a phone with no signal still knows it's a field device. */
export const loadAccount = () => getSetting<Account | null>(ACCOUNT_KEY);
export const saveAccount = (a: Account | null) => setSetting(ACCOUNT_KEY, a);

/** The hosted mailbox lives on this same origin, and the session cookie does the auth. */
export const HOSTED_PAIRING: Pairing = { baseUrl: '' };

/** Full-page navigation: GitHub sends the browser back to /base. */
export const GITHUB_SIGN_IN_URL = '/api/auth/github';

const post = (path: string, body: unknown = {}) =>
  fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

async function ok(res: Response): Promise<Response> {
  if (res.ok) return res;
  const { error } = (await res.json().catch(() => ({}))) as { error?: string };
  throw Object.assign(new Error(error ?? `${res.status} ${res.statusText}`), { status: res.status });
}

export const accountApi = {
  /**
   * The signed-in user, or null only when the server says "signed out". Anything else
   * throws, so a phone with no signal doesn't mistake "offline" for "signed out".
   */
  async me(): Promise<AccountUser | null> {
    const res = await fetch('/api/me', { signal: AbortSignal.timeout(8_000) });
    if (res.status === 401) return null;
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error(`No account API (${res.status})`);
    return (await res.json()) as AccountUser;
  },
  /** Laptop: a one-time link for the phone's QR code. */
  linkCode: async () => (await (await ok(await post('/api/link-codes'))).json()) as { url: string; expiresAt: number },
  /** Phone: trade the QR code for a session on this device. */
  redeem: async (code: string) => void (await ok(await post('/api/link', { code }))),
  signOut: async () => void (await ok(await post('/api/auth/logout'))),
  deleteAccount: async () => void (await ok(await post('/api/account/delete'))),
};
