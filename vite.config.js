import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.js',
    restoreMocks: true,
  },
  build: {
    cssCodeSplit: true,
    sourcemap: false,
    target: 'es2022',
  },
  server: {
    port: 4173,
  },
  preview: {
    port: 4173,
  },
});
