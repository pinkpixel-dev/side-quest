/// <reference lib="webworker" />
import {
  AutoProcessor,
  Gemma4ForConditionalGeneration,
  RawImage,
  TextStreamer,
  env,
  type PreTrainedModel,
  type Processor,
} from '@huggingface/transformers';
import { MODELS, type ModelKey } from './models';
import type { FromWorker, GenerateRequest, ToWorker } from './protocol';

env.allowLocalModels = false;

let processor: Processor | null = null;
let model: PreTrainedModel | null = null;

const post = (msg: FromWorker) => self.postMessage(msg);

interface GpuAdapterLike {
  features: { has(name: string): boolean };
  info?: { vendor?: string; architecture?: string; description?: string };
}

/** Same fallback order as hjkl: some setups only answer one power preference. */
async function findAdapter(): Promise<GpuAdapterLike | null> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(o?: object): Promise<GpuAdapterLike | null> } }).gpu;
  if (!gpu) return null;
  for (const powerPreference of ['high-performance', undefined, 'low-power']) {
    const adapter = await gpu.requestAdapter(powerPreference ? { powerPreference } : undefined);
    if (adapter) return adapter;
  }
  return null;
}

async function load(key: ModelKey) {
  const adapter = await findAdapter();
  if (!adapter) {
    post({ type: 'error', fatal: true, message: 'WebGPU is not available in this browser.' });
    return;
  }
  const spec = MODELS[key];
  const f16 = adapter.features.has('shader-f16');
  const dtype = f16 ? spec.dtypes.f16 : spec.dtypes.fallback;
  if (!dtype) {
    post({ type: 'error', fatal: true, message: `${spec.label} needs WebGPU shader-f16, which this GPU doesn't expose.` });
    return;
  }
  const info = adapter.info;
  post({ type: 'loading', f16, adapter: [info?.vendor, info?.architecture || info?.description].filter(Boolean).join(' ') || 'unknown' });

  const started = performance.now();
  processor = await AutoProcessor.from_pretrained(spec.repo);
  model = await Gemma4ForConditionalGeneration.from_pretrained(spec.repo, {
    // Per-session dtypes are supported at runtime; the public type only lists the string form.
    dtype: dtype as never,
    device: 'webgpu',
    progress_callback: (p) => {
      if (p.status === 'progress_total') post({ type: 'progress', loaded: p.loaded, total: p.total });
    },
  });
  post({ type: 'ready', loadMs: performance.now() - started });
}

async function generate(req: GenerateRequest) {
  if (!processor || !model) throw new Error('Model is not loaded.');
  const content: { type: string; text?: string }[] = req.image ? [{ type: 'image' }] : [];
  content.push({ type: 'text', text: req.prompt });
  const messages = [
    { role: 'system', content: req.system },
    { role: 'user', content },
  ];
  const prompt = processor.apply_chat_template(messages as never, {
    enable_thinking: false,
    add_generation_prompt: true,
  } as never) as string;

  const started = performance.now();
  let image: RawImage | null = null;
  if (req.image) {
    image = await RawImage.fromBlob(req.image);
    // Lower budgets encode faster; "is there a plant on concrete" doesn't need OCR-level detail.
    const imageProcessor = (processor as unknown as { image_processor: { max_soft_tokens: number } }).image_processor;
    imageProcessor.max_soft_tokens = req.imageBudget ?? 280;
  }
  const { num_soft_tokens_per_image, ...inputs } = (await processor(prompt, image, null, {
    add_special_tokens: false,
  })) as Record<string, unknown> & { num_soft_tokens_per_image?: number[] };

  let text = '';
  let tokens = 0;
  let firstAt = 0;
  const streamer = new TextStreamer(processor.tokenizer!, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (chunk: string) => {
      if (!firstAt) firstAt = performance.now();
      tokens++;
      text += chunk;
      post({ type: 'token', id: req.id, text: chunk });
    },
  });

  await model.generate({
    ...inputs,
    max_new_tokens: req.maxTokens,
    do_sample: !!req.sample,
    // Gemma 4's recommended sampling settings, from the model card.
    ...(req.sample ? { temperature: 1.0, top_p: 0.95, top_k: 64 } : {}),
    streamer,
  });
  const end = performance.now();
  const genSeconds = firstAt ? (end - firstAt) / 1000 : 0;
  post({
    type: 'done',
    id: req.id,
    text,
    stats: {
      firstTokenMs: (firstAt || end) - started,
      tokensPerSecond: genSeconds > 0 ? tokens / genSeconds : 0,
      tokens,
      imageTokens: num_soft_tokens_per_image?.[0] ?? 0,
    },
  });
}

// One job at a time: generation waits for the load to finish.
let queue: Promise<void> = Promise.resolve();

/** ONNX Runtime surfaces a lost WebGPU device as "[Device] is lost". Every later job would fail too. */
const deviceLost = (message: string) => /device\]? (is |was )?lost/i.test(message);

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  const run = msg.type === 'load' ? () => load(msg.model) : () => generate(msg);
  queue = queue.then(run).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    post({
      type: 'error',
      id: msg.type === 'generate' ? msg.id : undefined,
      fatal: msg.type === 'load' || deviceLost(message),
      message,
    });
  });
};
