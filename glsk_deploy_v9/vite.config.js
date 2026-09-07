import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        auction: resolve(import.meta.dirname, 'index.html'),
        supplemental: resolve(import.meta.dirname, 'supplemental.html'),
      },
    },
  },
});
