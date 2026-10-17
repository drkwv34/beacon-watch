import { describe, expect, it } from 'vitest';
import { PublicStatusBody } from './schemas.js';

describe('PublicStatusBody contract (SRS Appendix A)', () => {
  it('accepts an up payload with null incident', () => {
    expect(
      PublicStatusBody.parse({
        name: 'Portfolio demo API',
        status: 'up',
        last_checked_at: '2026-09-24T21:00:00.000Z',
        latency_ms: 42,
        uptime_24h: 0.997,
        open_incident: null,
      }),
    ).toMatchObject({ name: 'Portfolio demo API', status: 'up', latency_ms: 42 });
  });

  it('accepts a down payload with an open incident', () => {
    expect(
      PublicStatusBody.parse({
        name: 'Portfolio demo API',
        status: 'down',
        last_checked_at: '2026-09-24T21:05:00.000Z',
        latency_ms: null,
        uptime_24h: 0.981,
        open_incident: {
          opened_at: '2026-09-24T21:04:00.000Z',
          duration_seconds: 60,
        },
      }),
    ).toMatchObject({
      status: 'down',
      open_incident: { duration_seconds: 60 },
    });
  });

  it('rejects leaking extra identity fields as the required shape', () => {
    const parsed = PublicStatusBody.parse({
      name: 'Portfolio demo API',
      status: 'up',
      last_checked_at: null,
      latency_ms: null,
      uptime_24h: null,
      open_incident: null,
    });
    expect(parsed).not.toHaveProperty('id');
    expect(parsed).not.toHaveProperty('url');
  });
});
