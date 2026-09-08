import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        auction: resolve(import.meta.dirname, 'index.html'),
        supplemental: resolve(import.meta.dirname, 'supplemental.html'),
        phase3: resolve(import.meta.dirname, 'phase3.html'),
        league: resolve(import.meta.dirname, 'league.html'),
      },
    },
  },
});
