import { defineConfig } from 'vitest/config';

const conditions = ['@beacon-watch/source', 'module', 'node', 'import', 'default'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions, externalConditions: conditions } },
  test: {
    include: ['{apps,packages}/*/src/**/*.test.{ts,tsx}', 'mock-target/src/**/*.test.js'],
    passWithNoTests: false,
    fileParallelism: false,
  },
});
