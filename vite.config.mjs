import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsDir: 'build-assets',
    sourcemap: false,
  },
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:5000',
      '/assets': 'http://127.0.0.1:5000',
      '/bootstrap_css': 'http://127.0.0.1:5000',
    },
  },
});
