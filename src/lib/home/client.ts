import { getSetting, setSetting } from '../db/database';
import type { QuestContext } from '../../features/quests/questContext';
import {
  HOME_PORT,
  type BaseJobs,
  type BaseSession,
  type Find,
  type FindResult,
  type FindUpload,
  type HelloResponse,
  type HuntDraft,
  type HuntResult,
  type HuntSubmission,
  type HuntUpload,
  type QuestDraft,
} from './protocol';

export interface Pairing {
  /** '' means this same origin: the hosted site, where the session cookie does the auth. */
  baseUrl: string;
  /** Only for `npm run home`. */
  token?: string;
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

/** The phone's side. Every call carries the pairing token, or the session cookie on the hosted site. */
export function fieldApi({ baseUrl, token }: Pairing) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return {
    hello: () => request<HelloResponse>(`${baseUrl}/api/hello`, { headers }, 8_000),
    nextQuest: (context: QuestContext | null) =>
      request<QuestDraft>(`${baseUrl}/api/quests/next`, { method: 'POST', headers, body: JSON.stringify({ context }) }, 8_000),
    upload: (find: FindUpload) =>
      request<Find>(`${baseUrl}/api/finds`, { method: 'POST', headers, body: JSON.stringify(find) }, 60_000),
    finds: (ids: string[]) => request<Find[]>(`${baseUrl}/api/finds?ids=${ids.map(encodeURIComponent).join(',')}`, { headers }),
    nextHunt: (context: QuestContext | null) =>
      request<HuntDraft>(`${baseUrl}/api/hunts/next`, { method: 'POST', headers, body: JSON.stringify({ context }) }, 8_000),
    /** Ten photos in one go, so give a slow connection plenty of time. */
    uploadHunt: (hunt: HuntUpload) =>
      request<HuntSubmission>(`${baseUrl}/api/hunts`, { method: 'POST', headers, body: JSON.stringify(hunt) }, 180_000),
    hunts: (ids: string[]) =>
      request<HuntSubmission[]>(`${baseUrl}/api/hunts?ids=${ids.map(encodeURIComponent).join(',')}`, { headers }),
  };
}

/**
 * The laptop tab's side. With `npm run home` these only answer on the home computer itself.
 * On the hosted site, origin is '' and the session cookie decides whose finds these are.
 */
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
    huntPhoto: async (huntId: string, itemId: string) => {
      const res = await fetch(`${origin}/api/base/hunts/${encodeURIComponent(huntId)}/photo/${encodeURIComponent(itemId)}`);
      if (!res.ok) throw new Error(`Hunt photo ${res.status}`);
      return res.blob();
    },
    resolveHunt: (id: string, result: HuntResult) =>
      request<HuntSubmission>(`${origin}/api/base/hunts/${encodeURIComponent(id)}/result`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify(result),
      }),
    addHunt: (hunt: HuntDraft, context: QuestContext | null) =>
      request<void>(`${origin}/api/base/hunt-pool`, { method: 'POST', headers: json, body: JSON.stringify({ hunt, context }) }),
    /** `context` is what the quest was written for; the server drops it if the phone has moved on. */
    addQuest: (quest: QuestDraft, context: QuestContext | null) =>
      request<void>(`${origin}/api/quests`, { method: 'POST', headers: json, body: JSON.stringify({ quest, context }) }),
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
