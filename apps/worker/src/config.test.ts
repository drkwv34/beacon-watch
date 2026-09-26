import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('worker config', () => {
  it('defaults SSRF protection on and applies SRS concurrency limits', () => {
    const config = loadConfig({});
    expect(config.SSRF_PROTECTION).toBe(true);
    expect(config.PROBE_MAX_CONCURRENCY).toBe(20);
    expect(config.PROBE_MAX_PER_HOST).toBe(2);
  });

  it('rejects invalid values without echoing them', () => {
    expect(() => loadConfig({ SSRF_PROTECTION: 'maybe' })).toThrow('Invalid worker configuration: SSRF_PROTECTION');
  });
});
