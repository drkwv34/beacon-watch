import { lookup as dnsLookup } from 'node:dns/promises';
import { DomainError, isBlockedHostname, isBlockedIp, parseHttpUrl, parseIPv4 } from '@beacon-watch/domain';
import type { ApiConfig } from './config.js';

export type LookupFn = (hostname: string) => Promise<string[]>;

const LOOKUP_MS = 2000;

export const systemLookup: LookupFn = async (hostname) => {
  const result = await Promise.race([
    dnsLookup(hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('lookup timeout')), LOOKUP_MS);
    }),
  ]);
  return result.map((entry) => entry.address);
};

function looksLikeIp(hostname: string): boolean {
  return parseIPv4(hostname) !== null || hostname.includes(':');
}

export async function assertUrlAllowed(
  rawUrl: string,
  config: Pick<ApiConfig, 'SSRF_PROTECTION' | 'SSRF_ALLOWLIST'>,
  lookup: LookupFn,
): Promise<void> {
  const parsed = parseHttpUrl(rawUrl);
  const host = parsed.hostname.toLowerCase();
  if (config.SSRF_ALLOWLIST.includes(host)) return;
  if (!config.SSRF_PROTECTION) return;

  if (isBlockedHostname(host) || (looksLikeIp(host) && isBlockedIp(host))) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid target', { fields: { url: 'host is not allowed' } });
  }
  if (looksLikeIp(host)) return;

  let addresses: string[];
  try {
    addresses = await lookup(host);
  } catch {
    throw new DomainError('VALIDATION_FAILED', 'Invalid target', {
      fields: { url: 'hostname could not be resolved' },
    });
  }
  if (addresses.length === 0 || addresses.some((address) => isBlockedIp(address))) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid target', {
      fields: { url: 'host resolves to a private address' },
    });
  }
}
