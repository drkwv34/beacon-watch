import { describe, expect, it } from 'vitest';
import { DEMO_LIVE_URL, parseSeedEnv, rewriteComposeDatabaseUrl } from './seed.js';

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
