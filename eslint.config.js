import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**', '**/next-env.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },
  {
    files: ['packages/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'fastify',
                'next',
                'next/*',
                'react',
                'pg',
                'ioredis',
                'redis',
                'undici',
                'node:http',
                'node:https',
                'node:net',
                '@beacon-watch/db',
              ],
              message: 'packages/domain is pure TypeScript: no HTTP, IO, framework, or persistence imports.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', { name: 'fetch', message: 'No network access from the domain.' }],
    },
  },
  {
    files: ['apps/api/**/*.ts', 'apps/worker/**/*.ts', 'packages/db/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Outbound HTTP goes through the isolated probe client (apps/worker/src/probe) only.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['undici', 'axios', 'got', 'node-fetch', 'node:http', 'node:https'],
              message: 'Outbound HTTP goes through the isolated probe client (apps/worker/src/probe) only.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/worker/src/probe/**/*.ts'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['mock-target/**/*.js'],
    rules: { 'no-console': 'off' },
  },
);
