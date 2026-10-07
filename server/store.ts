import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Find } from '../src/lib/home/protocol.ts';
import type { QuestDraft } from '../src/features/quests/questSchemas.ts';

interface State {
  token: string;
  finds: Find[];
  /** Quests Gemma wrote ahead of time, waiting for the phone to pick them up. */
  questPool: QuestDraft[];
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

  addQuest(draft: QuestDraft): void {
    if (this.state.questPool.some((q) => q.title === draft.title)) return;
    this.state.questPool.push(draft);
    this.save();
  }

  takeQuest(): QuestDraft | undefined {
    const quest = this.state.questPool.shift();
    if (quest) this.save();
    return quest;
  }
}
