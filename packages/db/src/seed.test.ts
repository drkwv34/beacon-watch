import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEMO_LIVE_URL,
  loadSeedProcessEnv,
  mergeSeedEnv,
  parseDotEnv,
  parseSeedEnv,
  rewriteComposeDatabaseUrl,
} from './seed.js';

const required = {
  DATABASE_URL: 'postgresql://beacon:beacon-local-only@db:5432/beacon',
  DEMO_PASSWORD: 'demo-password-change-me',
};

describe('parseSeedEnv', () => {
  it('defaults interval 30s and demo-profile grace 1', () => {
    const parsed = parseSeedEnv(required);
    expect(parsed.intervalSeconds).toBe(30);
    expect(parsed.graceThreshold).toBe(1);
    expect(parsed.recoveryThreshold).toBe(1);
    expect(parsed.targetUrl).toBe(DEMO_LIVE_URL);
  });

  it('rejects a short DEMO_PASSWORD without echoing it', () => {
    expect(() => parseSeedEnv({ ...required, DEMO_PASSWORD: 'short' })).toThrow(
      'Invalid seed configuration: DEMO_PASSWORD',
    );
  });

  it('requires DATABASE_URL', () => {
    expect(() => parseSeedEnv({ DEMO_PASSWORD: 'demo-password-change-me' })).toThrow(
      'Invalid seed configuration: DATABASE_URL',
    );
  });
});

describe('parseDotEnv and mergeSeedEnv', () => {
  it('parses KEY=VALUE, ignores comments, and strips quotes', () => {
    expect(
      parseDotEnv('# comment\nDATABASE_URL=postgresql://beacon@db/beacon\nDEMO_PASSWORD="demo-password-change-me"\n'),
    ).toEqual({
      DATABASE_URL: 'postgresql://beacon@db/beacon',
      DEMO_PASSWORD: 'demo-password-change-me',
    });
  });

  it('lets exported environment variables win over the file', () => {
    const merged = mergeSeedEnv(
      { DATABASE_URL: 'from-file', DEMO_PASSWORD: 'file-password-value' },
      { DATABASE_URL: 'from-export' },
    );
    expect(merged.DATABASE_URL).toBe('from-export');
    expect(merged.DEMO_PASSWORD).toBe('file-password-value');
  });

  it('does not echo passwords when configuration is invalid', () => {
    expect(() => parseSeedEnv({ DEMO_PASSWORD: 'super-secret-password' })).toThrow(
      'Invalid seed configuration: DATABASE_URL',
    );
    try {
      parseSeedEnv({ DEMO_PASSWORD: 'super-secret-password' });
    } catch (err) {
      expect(String(err)).not.toContain('super-secret-password');
    }
  });
});

describe('loadSeedProcessEnv', () => {
  it('returns process env unchanged when the file is missing', async () => {
    const loaded = await loadSeedProcessEnv({
      processEnv: { DEMO_PASSWORD: 'exported-password-value' },
      envFilePath: join(tmpdir(), `beacon-watch-missing-${process.pid}.env`),
    });
    expect(loaded.DEMO_PASSWORD).toBe('exported-password-value');
    expect(loaded.DATABASE_URL).toBeUndefined();
  });

  it('fills unset keys from a temp .env file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'beacon-watch-seed-'));
    const envFilePath = join(dir, '.env');
    await writeFile(envFilePath, 'DATABASE_URL=postgresql://from-file\nDEMO_PASSWORD=file-password-value\n');
    const loaded = await loadSeedProcessEnv({ processEnv: {}, envFilePath });
    expect(loaded.DATABASE_URL).toBe('postgresql://from-file');
    expect(loaded.DEMO_PASSWORD).toBe('file-password-value');
  });
});

describe('rewriteComposeDatabaseUrl', () => {
  it('rewrites Compose db hostname when it does not resolve', () => {
    expect(rewriteComposeDatabaseUrl(required.DATABASE_URL, false)).toBe(
      'postgresql://beacon:beacon-local-only@127.0.0.1:5432/beacon',
    );
  });

  it('keeps db hostname when it resolves (in-network)', () => {
    expect(rewriteComposeDatabaseUrl(required.DATABASE_URL, true)).toBe(required.DATABASE_URL);
  });
});
