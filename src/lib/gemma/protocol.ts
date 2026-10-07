import type { ModelKey } from './models';

export interface GenerateRequest {
  id: number;
  system: string;
  prompt: string;
  /** JPEG/WebP blob. Omit for text-only prompts. */
  image?: Blob;
  imageBudget?: number;
  maxTokens: number;
  /** Sample with Gemma's recommended settings instead of greedy decoding (for variety). */
  sample?: boolean;
}

export interface GenerateStats {
  /** Image preprocessing + encode + prompt prefill, i.e. time to first token. */
  firstTokenMs: number;
  tokensPerSecond: number;
  tokens: number;
  imageTokens: number;
}

export type ToWorker = { type: 'load'; model: ModelKey } | ({ type: 'generate' } & GenerateRequest);

export type FromWorker =
  | { type: 'loading'; f16: boolean; adapter: string }
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; loadMs: number }
  | { type: 'token'; id: number; text: string }
  | { type: 'done'; id: number; text: string; stats: GenerateStats }
  | { type: 'error'; id?: number; message: string; fatal: boolean };
