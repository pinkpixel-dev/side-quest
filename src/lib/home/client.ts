import { getSetting, setSetting } from '../db/database';
import {
  HOME_PORT,
  type BaseJobs,
  type BaseSession,
  type Find,
  type FindResult,
  type FindUpload,
  type HelloResponse,
  type QuestDraft,
} from './protocol';

export interface Pairing {
  baseUrl: string;
  token: string;
}

const PAIRING_KEY = 'homePairing';

export const loadPairing = () => getSetting<Pairing | null>(PAIRING_KEY);
export const savePairing = (p: Pairing | null) => setSetting(PAIRING_KEY, p);

/** Reads `#base=…&token=…` (or just `#token=…` when the app came through the tunnel itself). */
export function pairingFromHash(hash: string, origin: string): Pairing | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('token');
  const baseUrl = params.get('base') ?? origin;
  if (!token || !/^https?:\/\//.test(baseUrl)) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ''), token };
}

async function request<T>(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T | null> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/** The phone's side. Every call carries the pairing token. */
export function fieldApi({ baseUrl, token }: Pairing) {
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  return {
    hello: () => request<HelloResponse>(`${baseUrl}/api/hello`, { headers }, 8_000),
    nextQuest: () => request<QuestDraft>(`${baseUrl}/api/quests/next`, { method: 'POST', headers }, 8_000),
    upload: (find: FindUpload) =>
      request<Find>(`${baseUrl}/api/finds`, { method: 'POST', headers, body: JSON.stringify(find) }, 60_000),
    finds: (ids: string[]) => request<Find[]>(`${baseUrl}/api/finds?ids=${ids.map(encodeURIComponent).join(',')}`, { headers }),
  };
}

/** The laptop tab's side. These endpoints only answer on the home computer itself. */
export function baseApi(origin: string) {
  const json = { 'content-type': 'application/json' };
  return {
    session: () => request<BaseSession>(`${origin}/api/base/session`, {}, 1_500),
    checkIn: (gemmaReady: boolean) =>
      request<BaseJobs>(`${origin}/api/base/checkin`, { method: 'POST', headers: json, body: JSON.stringify({ gemmaReady }) }),
    photo: async (id: string) => {
      const res = await fetch(`${origin}/api/finds/${encodeURIComponent(id)}/photo`);
      if (!res.ok) throw new Error(`Photo ${res.status}`);
      return res.blob();
    },
    resolve: (id: string, result: FindResult) =>
      request<Find>(`${origin}/api/finds/${encodeURIComponent(id)}/result`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify(result),
      }),
    addQuest: (quest: QuestDraft) =>
      request<void>(`${origin}/api/quests`, { method: 'POST', headers: json, body: JSON.stringify({ quest }) }),
  };
}

/**
 * Is this tab running on the home computer next to `npm run home`? Either the app is
 * served by the home server itself, or it's the dev server on localhost.
 */
export async function findHomeServer(): Promise<{ origin: string; session: BaseSession } | null> {
  const { hostname, port, origin } = location;
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') return null;
  const candidate = port === String(HOME_PORT) ? origin : `http://127.0.0.1:${HOME_PORT}`;
  try {
    const session = await baseApi(candidate).session();
    return session ? { origin: candidate, session } : null;
  } catch {
    return null;
  }
}

/** Base64 data URL without FileReader, so it also runs in tests. Chunked to stay under argument limits. */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
}
