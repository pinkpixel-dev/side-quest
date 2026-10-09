import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Find, HuntResult, HuntSubmission } from '../src/lib/home/protocol.ts';
import type { HuntDraft } from '../src/features/hunts/huntSchemas.ts';
import type { QuestDraft } from '../src/features/quests/questSchemas.ts';
import { contextKey, isQuestContext, type QuestContext } from '../src/features/quests/questContext.ts';

interface State {
  token: string;
  finds: Find[];
  /** Quests Gemma wrote ahead of time, waiting for the phone to pick them up. */
  questPool: QuestDraft[];
  /** Hunts the phone sent home. Older home.json files don't have these yet. */
  hunts?: HuntSubmission[];
  /** Hunt lists Gemma wrote ahead of time. */
  huntPool?: HuntDraft[];
  /** The phone's latest setting / weather / season / time. */
  context?: QuestContext;
}

/** Everything lives in ~/.side-quest (or $SIDE_QUEST_HOME): photos stay on this machine. */
export class Store {
  readonly dir: string;
  private readonly file: string;
  private state: State;

  constructor(dir = process.env.SIDE_QUEST_HOME ?? join(homedir(), '.side-quest')) {
    this.dir = dir;
    this.file = join(dir, 'home.json');
    mkdirSync(join(dir, 'photos'), { recursive: true });
    this.state = existsSync(this.file)
      ? (JSON.parse(readFileSync(this.file, 'utf8')) as State)
      : { token: randomBytes(24).toString('base64url'), finds: [], questPool: [] };
    this.state.hunts ??= [];
    this.state.huntPool ??= [];
    // A context saved before a setting was renamed would give Gemma a broken prompt.
    if (this.state.context && !isQuestContext(this.state.context)) delete this.state.context;
    this.save();
  }

  /** Pairing token. Kept across restarts so the phone stays paired. */
  get token(): string {
    return this.state.token;
  }

  private save() {
    // Write-then-rename so a crash mid-write never leaves a half-written file.
    writeFileSync(`${this.file}.tmp`, JSON.stringify(this.state));
    renameSync(`${this.file}.tmp`, this.file);
  }

  photoPath(id: string): string {
    if (!/^[\w-]+$/.test(id)) throw new Error('Bad id');
    return join(this.dir, 'photos', `${id}.jpg`);
  }

  /** Idempotent: the phone retries uploads, so a repeat id is a no-op. */
  addFind(find: Find, jpeg: Buffer): void {
    if (this.getFind(find.id)) return;
    writeFileSync(this.photoPath(find.id), jpeg);
    this.state.finds.push(find);
    this.save();
  }

  getFind(id: string): Find | undefined {
    return this.state.finds.find((f) => f.id === id);
  }

  waitingFinds(): Find[] {
    return this.state.finds.filter((f) => f.status === 'waiting');
  }

  resolveFind(id: string, update: Pick<Find, 'status' | 'creature' | 'reason'>): Find | undefined {
    const find = this.getFind(id);
    if (!find) return undefined;
    Object.assign(find, update, { resolvedAt: Date.now() });
    this.save();
    return find;
  }

  get questsReady(): number {
    return this.state.questPool.length;
  }

  /** Skips quests written for a context the phone has since left behind. */
  addQuest(draft: QuestDraft, writtenFor: QuestContext | null = null): void {
    if (this.state.context && (!writtenFor || contextKey(writtenFor) !== contextKey(this.state.context))) return;
    if (this.state.questPool.some((q) => q.title === draft.title)) return;
    this.state.questPool.push(draft);
    this.save();
  }

  get context(): QuestContext | null {
    return this.state.context ?? null;
  }

  /** New context from the phone. Quests written for a different one are dropped. */
  setContext(context: QuestContext): void {
    if (this.state.context && contextKey(this.state.context) === contextKey(context)) return;
    this.state.context = context;
    this.state.questPool = [];
    this.state.huntPool = [];
    this.save();
  }

  takeQuest(): QuestDraft | undefined {
    const quest = this.state.questPool.shift();
    if (quest) this.save();
    return quest;
  }

  // --- hunts -----------------------------------------------------------------------

  huntPhotoPath(huntId: string, itemId: string): string {
    return this.photoPath(`${huntId}_${itemId}`);
  }

  /** Idempotent like addFind: a retried upload is a no-op. */
  addHunt(hunt: HuntSubmission, photos: Map<string, Buffer>): void {
    if (this.getHunt(hunt.id)) return;
    for (const [itemId, jpeg] of photos) writeFileSync(this.huntPhotoPath(hunt.id, itemId), jpeg);
    this.state.hunts!.push(hunt);
    this.save();
  }

  getHunt(id: string): HuntSubmission | undefined {
    return this.state.hunts!.find((h) => h.id === id);
  }

  waitingHunts(): HuntSubmission[] {
    return this.state.hunts!.filter((h) => h.status === 'waiting');
  }

  resolveHunt(id: string, result: HuntResult): HuntSubmission | undefined {
    const hunt = this.getHunt(id);
    if (!hunt) return undefined;
    Object.assign(hunt, { status: 'done', result, resolvedAt: Date.now() });
    this.save();
    return hunt;
  }

  get huntsReady(): number {
    return this.state.huntPool!.length;
  }

  /** Same context rule as quests. */
  addHuntDraft(draft: HuntDraft, writtenFor: QuestContext | null = null): void {
    if (this.state.context && (!writtenFor || contextKey(writtenFor) !== contextKey(this.state.context))) return;
    this.state.huntPool!.push(draft);
    this.save();
  }

  takeHunt(): HuntDraft | undefined {
    const draft = this.state.huntPool!.shift();
    if (draft) this.save();
    return draft;
  }
}
