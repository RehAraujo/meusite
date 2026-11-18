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
      'tests/commerce-reconciliation.test.js',
      'tests/commerce-downloads.test.js',
      'tests/commerce-production.test.js',
      'tests/commerce-launch.test.jsx',
      'tests/commerce-credentials.test.js',
      'tests/commerce-session.test.js',
      'tests/checkout.test.jsx',
      'tests/commerce-sandbox.test.js',
      'tests/commerce-staging.test.js',
      'tests/commerce-config.test.js',
      'tests/commerce-recovery.test.jsx',
      'tests/commerce-notion-access.test.js',
      'tests/commerce-notion-access-ui.test.jsx',
    ],
  },
});
