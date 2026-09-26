import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['@beacon-watch/source'],
  },
  test: {
    include: ['{apps,packages}/*/src/**/*.test.ts'],
    passWithNoTests: false,
  },
});
