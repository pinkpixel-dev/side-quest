// Shared between the phone (field), the home server, and the laptop tab running Gemma (base).
// Type-only so the Node server can import it without a build step.
import type { Creature } from '../../features/creatures/creatureSchemas';
import type { Quest, QuestDraft } from '../../features/quests/questSchemas';

export const HOME_PORT = 4317;

export type FindStatus = 'waiting' | 'hatched' | 'not-quite' | 'confused';

/** A photo the phone sent home, and what happened to it. */
export interface Find {
  id: string;
  quest: Quest;
  createdAt: number;
  status: FindStatus;
  /** Set when hatched. Includes palette, seed and traits so the phone can draw it. */
  creature?: Creature;
  /** Gemma's one-liner when it couldn't spot the quest. */
  reason?: string;
  resolvedAt?: number;
}

/** Phone -> server. The photo travels as a JPEG data URL (about 200 KB after preprocessing). */
export interface FindUpload {
  id: string;
  quest: Quest;
  photo: string;
  createdAt: number;
}

/** Base tab -> server, after Gemma has looked. */
export interface FindResult {
  status: Exclude<FindStatus, 'waiting'>;
  creature?: Creature;
  reason?: string;
}

export interface HelloResponse {
  app: 'side-quest-home';
  /** True when the laptop tab has checked in recently, so finds will get judged soon. */
  baseOnline: boolean;
  gemmaReady: boolean;
  questsReady: number;
}

/** Only answered for requests made on the laptop itself, never through the tunnel. */
export interface BaseSession {
  token: string;
  tunnelUrl: string | null;
  pairUrl: string | null;
  qrSvg: string | null;
}

export interface BaseCheckIn {
  gemmaReady: boolean;
}

export interface BaseJobs {
  waiting: Find[];
  questsReady: number;
  questsWanted: number;
}

export type { QuestDraft };
