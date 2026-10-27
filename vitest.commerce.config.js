import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Does not inherit the site's config or load .env/.dev.vars from the workspace.
export default defineConfig({
  envDir: false,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.js',
    restoreMocks: true,
    include: [
      'tests/commerce.test.js',
      'tests/checkout.test.jsx',
      'tests/commerce-sandbox.test.js',
      'tests/commerce-staging.test.js',
    ],
  },
});
