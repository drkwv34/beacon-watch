import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const required = {
  DATABASE_URL: 'postgres://beacon:beacon@localhost:5432/beacon',
  SESSION_SECRET: 'replace-me-with-at-least-32-random-characters',
};

describe('api config', () => {
  it('defaults session TTL to 7 days and SSRF on', () => {
    const config = loadConfig(required);
    expect(config.SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
    expect(config.SSRF_PROTECTION).toBe(true);
    expect(config.SSRF_ALLOWLIST).toEqual([]);
  });

  it('parses a comma-separated SSRF allowlist', () => {
    const config = loadConfig({ ...required, SSRF_ALLOWLIST: 'mock-target, localhost' });
    expect(config.SSRF_ALLOWLIST).toEqual(['mock-target', 'localhost']);
  });

  it('rejects a short SESSION_SECRET without echoing it', () => {
    expect(() => loadConfig({ ...required, SESSION_SECRET: 'short' })).toThrow(
      'Invalid API configuration: SESSION_SECRET',
    );
  });
});
