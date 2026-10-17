import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const required = {
  DATABASE_URL: 'postgres://beacon:beacon@localhost:5432/beacon',
  SESSION_SECRET: 'replace-me-with-at-least-32-random-characters',
  REDIS_URL: 'redis://127.0.0.1:6379',
};

describe('api config', () => {
  it('defaults session TTL to 7 days and SSRF on', () => {
    const config = loadConfig(required);
    expect(config.SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
    expect(config.SSRF_PROTECTION).toBe(true);
    expect(config.SSRF_ALLOWLIST).toEqual([]);
    expect(config.PUBLIC_RATE_LIMIT_PER_MIN).toBe(60);
    expect(config.TRUST_PROXY).toBe(false);
    expect(config.PUBLIC_CORS_ORIGINS).toEqual([]);
    expect(config.REDIS_CONNECT_TIMEOUT_MS).toBe(200);
    expect(config.REDIS_COMMAND_TIMEOUT_MS).toBe(200);
  });

  it('parses a CORS allowlist and trustProxy', () => {
    const config = loadConfig({
      ...required,
      TRUST_PROXY: 'true',
      PUBLIC_CORS_ORIGINS: 'https://status.example, https://other.example',
      PUBLIC_RATE_LIMIT_PER_MIN: '30',
    });
    expect(config.TRUST_PROXY).toBe(true);
    expect(config.PUBLIC_CORS_ORIGINS).toEqual(['https://status.example', 'https://other.example']);
    expect(config.PUBLIC_RATE_LIMIT_PER_MIN).toBe(30);
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
