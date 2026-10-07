import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
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

/** Vite only serves the model test page at /spike/ with the slash. */
const spikeRedirect = (): Plugin => ({
  name: 'spike-redirect',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] !== '/spike') return next();
      res.statusCode = 302;
      res.setHeader('Location', '/spike/');
      res.end();
    });
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), dropOrtWasm(), spikeRedirect()],
  worker: { format: 'es', plugins: () => [dropOrtWasm()] },
  // Phones reach the dev server through `npm run tunnel` (cloudflared quick tunnel).
  server: { allowedHosts: ['.trycloudflare.com'] },
  build: {
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        spike: resolve(import.meta.dirname, 'spike/index.html'),
      },
    },
  },
  test: { environment: 'node' },
});
