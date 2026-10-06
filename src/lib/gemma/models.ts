export type ModelKey = 'e2b-mobile' | 'e2b';

/** Per-session dtypes, keyed by ONNX file prefix. */
export type SessionDtypes = Record<string, string>;

export interface GemmaModel {
  key: ModelKey;
  label: string;
  repo: string;
  /** Needs the WebGPU `shader-f16` feature. Null means it runs on any adapter. */
  dtypes: { f16: SessionDtypes; fallback: SessionDtypes | null };
  /** Download size for the files we load, from the Hub listing (Oct 2026). */
  approxBytes: number;
}

// Both load through Gemma4ForConditionalGeneration, which pulls embed_tokens, decoder,
// vision_encoder and (unavoidably, in Transformers.js 4.3) audio_encoder.
export const MODELS: Record<ModelKey, GemmaModel> = {
  'e2b-mobile': {
    key: 'e2b-mobile',
    label: 'Gemma 4 E2B mobile (QAT, 2-bit)',
    repo: 'onnx-community/gemma-4-E2B-it-qat-mobile-ONNX',
    dtypes: {
      f16: { embed_tokens: 'q2f16', decoder_model_merged: 'q2f16', vision_encoder: 'fp16', audio_encoder: 'q2f16' },
      fallback: null,
    },
    approxBytes: 2.57e9,
  },
  e2b: {
    key: 'e2b',
    label: 'Gemma 4 E2B (4-bit)',
    repo: 'onnx-community/gemma-4-E2B-it-ONNX',
    dtypes: {
      f16: { embed_tokens: 'q4f16', decoder_model_merged: 'q4f16', vision_encoder: 'q4f16', audio_encoder: 'q4f16' },
      fallback: { embed_tokens: 'q4', decoder_model_merged: 'q4', vision_encoder: 'q4', audio_encoder: 'q4' },
    },
    approxBytes: 3.38e9,
  },
};

/** Gemma 4 image budgets: how many soft tokens one image turns into. */
export const IMAGE_BUDGETS = [70, 140, 280, 560] as const;
export type ImageBudget = (typeof IMAGE_BUDGETS)[number];

export function formatBytes(bytes: number): string {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${Math.round(bytes / 1e6)} MB`;
}
