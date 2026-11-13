import { describe, expect, it } from 'vitest';
import { loadConfig, ssrfProtectionWarning } from './config.js';

const db = {
  DATABASE_URL: 'postgresql://beacon:beacon@localhost:5432/beacon',
  REDIS_URL: 'redis://127.0.0.1:6379',
};

describe('worker config', () => {
  it('defaults SSRF protection on and applies SRS concurrency limits', () => {
    const config = loadConfig(db);
    expect(config.SSRF_PROTECTION).toBe(true);
    expect(config.SSRF_HOST_EXCEPTION).toEqual([]);
    expect(config.REDIS_CONNECT_TIMEOUT_MS).toBe(200);
    expect(config.REDIS_COMMAND_TIMEOUT_MS).toBe(200);
    expect(config.PROBE_MAX_CONCURRENCY).toBe(20);
    expect(config.PROBE_MAX_PER_HOST).toBe(2);
    expect(config.PROBE_INSECURE_TLS).toBe(false);
    expect(config.SCHEDULER_POLL_MS).toBe(1000);
  });

  it('parses an exact hostname exception list for the Compose demo host', () => {
    const config = loadConfig({ ...db, SSRF_HOST_EXCEPTION: 'mock-target' });
    expect(config.SSRF_PROTECTION).toBe(true);
    expect(config.SSRF_HOST_EXCEPTION).toEqual(['mock-target']);
  });

  it('describes a warning when protection is explicitly off', () => {
    expect(ssrfProtectionWarning(true)).toBeNull();
    expect(ssrfProtectionWarning(false)).toMatch(/not the Compose demo path/);
  });

  it('rejects invalid values without echoing them', () => {
    expect(() => loadConfig({ ...db, SSRF_PROTECTION: 'maybe' })).toThrow(
      'Invalid worker configuration: SSRF_PROTECTION',
    );
  });

  it('rejects PROBE_INSECURE_TLS in production', () => {
    expect(() => loadConfig({ ...db, NODE_ENV: 'production', PROBE_INSECURE_TLS: 'true' })).toThrow(
      'Invalid worker configuration: PROBE_INSECURE_TLS',
    );
  });

  it('requires DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow('Invalid worker configuration: DATABASE_URL, REDIS_URL');
  });
});
