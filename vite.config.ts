import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

/**
 * Transformers.js loads ONNX Runtime's wasm from the jsDelivr CDN, so the copy Vite emits
 * is never fetched. It's also over Cloudflare's 25 MiB per-file limit. Same fix as hjkl.
 */
const dropOrtWasm = (): Plugin => ({
  name: 'drop-ort-wasm',
  apply: 'build',
  generateBundle(_, bundle) {
    for (const file of Object.keys(bundle)) if (file.endsWith('.wasm')) delete bundle[file];
  },
});

export default defineConfig({
  plugins: [dropOrtWasm()],
  worker: { format: 'es', plugins: () => [dropOrtWasm()] },
  // Phones reach the dev server through `npm run tunnel` (cloudflared quick tunnel).
  server: { allowedHosts: ['.trycloudflare.com'] },
  build: {
    rollupOptions: {
      input: { spike: resolve(import.meta.dirname, 'spike/index.html') },
    },
  },
  test: { environment: 'node' },
});
