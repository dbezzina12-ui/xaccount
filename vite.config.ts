import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * Main build: the dashboard page (React) and the background service worker.
 * The content script is built separately (vite.content.config.ts) because
 * Chrome content scripts must be a single classic script with no imports.
 */
export default defineConfig({
  plugins: [react()],
  esbuild: { charset: 'ascii' },
  root: resolve(__dirname, 'src/dashboard'),
  publicDir: resolve(__dirname, 'public'),
  base: '',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'chrome110',
    sourcemap: false,
    rollupOptions: {
      input: {
        dashboard: resolve(__dirname, 'src/dashboard/dashboard.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
