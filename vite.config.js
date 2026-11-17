import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { renderAll } from './src/render.js';

export default defineConfig({
  // Relative asset paths so the build works from any folder or host.
  base: './',
  plugins: [
    {
      name: 'render-content',
      transformIndexHtml: (html) => renderAll(html),
    },
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        consent: resolve(import.meta.dirname, 'consent.html'),
      },
    },
  },
  server: { host: true },
  preview: { host: true },
});
