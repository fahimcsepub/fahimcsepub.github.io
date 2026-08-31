import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    // PDF rendering and the isolated bulk worker intentionally bundle fontkit/pdf-lib.
    chunkSizeWarningLimit: 1300,
  },
});
