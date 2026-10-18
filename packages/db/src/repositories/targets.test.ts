import { describe, expect, it } from 'vitest';
import { asTargetId, asUserId } from '@beacon-watch/domain';
import { toPublicTarget, type TargetRow } from './targets.js';

function row(overrides: Partial<TargetRow> = {}): TargetRow {
  const now = new Date('2026-10-14T00:00:00.000Z');
  return {
    id: asTargetId('11111111-1111-4111-8111-111111111111'),
    userId: asUserId('22222222-2222-4222-8222-222222222222'),
    name: 'Homepage',
    url: 'https://example.com',
    method: 'GET',
    intervalSeconds: 60,
    timeoutMs: 5000,
    expectedStatus: 200,
    headers: null,
    body: null,
    graceThreshold: 2,
    recoveryThreshold: 2,
    enabled: true,
    isPublic: false,
    publicSlug: null,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    lastStatus: 'unknown',
    lastCheckedAt: null,
    nextCheckAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('toPublicTarget', () => {
  it('maps snake_case JSON and derives paused from enabled=false', () => {
    const paused = toPublicTarget(row({ enabled: false, lastStatus: 'up' }));
    expect(paused.last_status).toBe('paused');
    expect(paused.enabled).toBe(false);
    expect(paused.latency_ms).toBeNull();
    expect(paused.created_at).toBe('2026-10-14T00:00:00.000Z');
  });

  it('includes latest latency when provided', () => {
    expect(toPublicTarget(row(), { latencyMs: 42 }).latency_ms).toBe(42);
  });
});
