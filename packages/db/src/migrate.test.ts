import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isMigrationFilename, listMigrationFiles } from './migrate.js';

describe('migration filenames', () => {
  it('accepts zero-padded SQL names only', () => {
    expect(isMigrationFilename('0001_users_sessions_targets.sql')).toBe(true);
    expect(isMigrationFilename('README.md')).toBe(false);
    expect(isMigrationFilename('1_too_short.sql')).toBe(false);
  });

  it('lists two fixture files lexically and ignores others', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bw-mig-'));
    await writeFile(path.join(dir, '0002_later.sql'), 'SELECT 2;');
    await writeFile(path.join(dir, '0001_first.sql'), 'SELECT 1;');
    await writeFile(path.join(dir, 'notes.txt'), 'nope');
    await expect(listMigrationFiles(dir)).resolves.toEqual(['0001_first.sql', '0002_later.sql']);
  });
});
