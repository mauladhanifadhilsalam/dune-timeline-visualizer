import { defineConfig } from 'vite';

// Relative base so the build works from any static host or sub-path (GitHub Pages, S3, file share).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1000,
  },
});
