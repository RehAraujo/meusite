import eslint from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  {
    ignores: [
      // Local agent worktrees/settings: copies of other branches, not project source.
      '.claude',
      'dist',
      '.prerender',
      '.wrangler',
      'public',
      'node_modules',
      '*.html',
      'curriculo.js',
      'legal-footer.js',
      'worker.js',
    ],
  },
  eslint.configs.recommended,
  {
    files: ['worker/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        ...globals.serviceworker,
        AbortSignal: 'readonly',
        TextEncoder: 'readonly',
        URL: 'readonly',
        crypto: 'readonly',
        fetch: 'readonly',
      },
      parserOptions: { sourceType: 'module' },
    },
  },
  {
    files: ['src/**/*.{js,jsx}', 'tests/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...reactHooks.configs['recommended-latest'].rules,
      ...reactRefresh.configs.vite.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
