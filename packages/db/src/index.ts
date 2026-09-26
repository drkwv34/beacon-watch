import { fileURLToPath } from 'node:url';

/**
 * Forward-only SQL migrations live here, named `NNNN_description.sql`.
 * Tooling, schema, and repositories arrive with the first approved OpenSpec change (Day 2).
 */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));
