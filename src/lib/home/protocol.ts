// Shared between the phone (field), the home server, and the laptop tab running Gemma (base).
// Type-only so the Node server can import it without a build step.
import type { Creature } from '../../features/creatures/creatureSchemas';
import type { QuestContext } from '../../features/quests/questContext';
import type { Quest, QuestDraft } from '../../features/quests/questSchemas';
import type { HuntDraft } from '../../features/hunts/huntSchemas';

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

/** Phone -> server: a finished hunt, every snapped item with its photo. */
export interface HuntUpload {
  id: string;
  title: string;
  createdAt: number;
  items: { id: string; text: string; photo: string }[];
}

/** Base tab -> server, after Gemma has checked the whole hunt. */
export interface HuntResult {
  items: { id: string; found: boolean; reason: string }[];
  creature?: Creature;
  /** Which item's photo the creature hatched from, so the phone can pair it with its own copy. */
  pickedItemId?: string;
}

/** A hunt sent home, and (once checked) how it went. Photos stay on disk, not in here. */
export interface HuntSubmission {
  id: string;
  title: string;
  createdAt: number;
  items: { id: string; text: string }[];
  status: 'waiting' | 'done';
  result?: HuntResult;
  resolvedAt?: number;
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
  huntsWaiting: HuntSubmission[];
  huntsReady: number;
  huntsWanted: number;
  /** Where and when the phone last said it was. Quests in the pool were written for this. */
  context: QuestContext | null;
}

export type { QuestDraft, HuntDraft };
