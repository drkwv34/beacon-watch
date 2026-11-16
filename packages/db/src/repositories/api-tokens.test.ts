import { describe, expect, it } from 'vitest';
import { asUserId } from '@beacon-watch/domain';
import { toPublicApiToken, type ApiTokenRow } from './api-tokens.js';

function row(overrides: Partial<ApiTokenRow> = {}): ApiTokenRow {
  const now = new Date('2026-11-16T00:00:00.000Z');
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userId: asUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    tokenHash: 'deadbeef',
    prefix: 'bw_abcd1234',
    label: 'ci',
    createdAt: now,
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    ...overrides,
  };
}

describe('toPublicApiToken', () => {
  it('omits the hash and any raw token field', () => {
    const json = toPublicApiToken(row());
    expect(json).toEqual({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      label: 'ci',
      prefix: 'bw_abcd1234',
      created_at: '2026-11-16T00:00:00.000Z',
      expires_at: null,
      last_used_at: null,
    });
    expect(json).not.toHaveProperty('token');
    expect(json).not.toHaveProperty('token_hash');
    expect(json).not.toHaveProperty('tokenHash');
  });
});
