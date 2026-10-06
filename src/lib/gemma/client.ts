import type { ModelKey } from './models';
import type { FromWorker, GenerateRequest, GenerateStats } from './protocol';

export type GemmaState =
  | { status: 'off' }
  | { status: 'loading'; model: ModelKey; adapter: string | null; f16: boolean | null; loaded: number; total: number }
  | { status: 'ready'; model: ModelKey; adapter: string; f16: boolean; loadMs: number }
  | { status: 'error'; model: ModelKey; message: string };

export interface GemmaResult {
  text: string;
  stats: GemmaStats;
}
export type GemmaStats = GenerateStats;

interface Pending {
  onToken?: (chunk: string) => void;
  resolve(result: GemmaResult): void;
  reject(err: Error): void;
}

/** Owns the Gemma worker. The thin interface the rest of Side Quest talks to. */
export class GemmaClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private listeners = new Set<(s: GemmaState) => void>();
  state: GemmaState = { status: 'off' };

  subscribe(fn: (s: GemmaState) => void): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private set(state: GemmaState) {
    this.state = state;
    this.listeners.forEach((fn) => fn(state));
  }

  load(model: ModelKey): void {
    this.unload();
    this.worker = new Worker(new URL('./gemma.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.handle(model, e.data);
    this.worker.onerror = (e) => this.fail(model, e.message || 'The Gemma worker crashed.');
    this.set({ status: 'loading', model, adapter: null, f16: null, loaded: 0, total: 0 });
    this.worker.postMessage({ type: 'load', model });
  }

  unload(): void {
    this.worker?.terminate();
    this.worker = null;
    this.rejectAll(new Error('Gemma was unloaded.'));
    this.set({ status: 'off' });
  }

  generate(req: Omit<GenerateRequest, 'id'>, onToken?: (chunk: string) => void): Promise<GemmaResult> {
    if (!this.worker || this.state.status === 'error' || this.state.status === 'off') {
      return Promise.reject(new Error('Gemma is not loaded.'));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { onToken, resolve, reject });
      this.worker!.postMessage({ type: 'generate', id, ...req });
    });
  }

  private fail(model: ModelKey, message: string) {
    this.worker?.terminate();
    this.worker = null;
    this.rejectAll(new Error(message));
    this.set({ status: 'error', model, message });
  }

  private rejectAll(err: Error) {
    this.pending.forEach((p) => p.reject(err));
    this.pending.clear();
  }

  private handle(model: ModelKey, msg: FromWorker) {
    switch (msg.type) {
      case 'loading':
        this.set({ status: 'loading', model, adapter: msg.adapter, f16: msg.f16, loaded: 0, total: 0 });
        break;
      case 'progress':
        if (this.state.status === 'loading') this.set({ ...this.state, loaded: msg.loaded, total: msg.total });
        break;
      case 'ready':
        if (this.state.status === 'loading') {
          this.set({ status: 'ready', model, adapter: this.state.adapter ?? 'unknown', f16: !!this.state.f16, loadMs: msg.loadMs });
        }
        break;
      case 'token':
        this.pending.get(msg.id)?.onToken?.(msg.text);
        break;
      case 'done': {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        p?.resolve({ text: msg.text, stats: msg.stats });
        break;
      }
      case 'error':
        if (msg.fatal) {
          this.fail(model, msg.message);
        } else if (msg.id !== undefined) {
          this.pending.get(msg.id)?.reject(new Error(msg.message));
          this.pending.delete(msg.id);
        }
        break;
    }
  }
}
