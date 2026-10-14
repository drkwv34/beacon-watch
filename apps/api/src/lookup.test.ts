import { describe, expect, it } from 'vitest';
import { DomainError } from '@beacon-watch/domain';
import { assertUrlAllowed } from './lookup.js';

const protectedConfig = { SSRF_PROTECTION: true, SSRF_ALLOWLIST: [] as string[] };

function fields(err: unknown): Record<string, string> {
  expect(err).toBeInstanceOf(DomainError);
  return (err as DomainError).details!['fields'] as Record<string, string>;
}

describe('assertUrlAllowed', () => {
  it('rejects loopback, RFC1918, and link-local literals', async () => {
    for (const url of [
      'http://127.0.0.1/',
      'http://10.0.0.1/',
      'http://172.16.0.1/',
      'http://192.168.1.1/',
      'http://169.254.169.254/',
    ]) {
      await expect(assertUrlAllowed(url, protectedConfig, async () => [])).rejects.toSatisfy((err) => {
        expect(fields(err)).toHaveProperty('url');
        return true;
      });
    }
  });

  it('rejects DNS that resolves to a private address', async () => {
    await expect(
      assertUrlAllowed('http://private.example.test/', protectedConfig, async () => ['10.0.0.5']),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects metadata hostnames', async () => {
    await expect(
      assertUrlAllowed('http://metadata.google.internal/', protectedConfig, async () => ['1.1.1.1']),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('allows an allowlisted hostname even if it would be private', async () => {
    await expect(
      assertUrlAllowed(
        'http://mock-target:8080/health',
        {
          SSRF_PROTECTION: true,
          SSRF_ALLOWLIST: ['mock-target'],
        },
        async () => ['172.18.0.4'],
      ),
    ).resolves.toBeUndefined();
  });

  it('allows a public resolution', async () => {
    await expect(
      assertUrlAllowed('https://example.com/health', protectedConfig, async () => ['93.184.216.34']),
    ).resolves.toBeUndefined();
  });
});
