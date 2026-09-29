import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/** Content script build: one self-contained IIFE, appended to dist/. */
export default defineConfig({
  publicDir: false,
  esbuild: { charset: 'ascii' },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    target: 'chrome110',
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'XBulkSchedulerContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
