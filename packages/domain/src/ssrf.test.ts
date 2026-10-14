import { describe, expect, it } from 'vitest';
import { isBlockedHostname, isBlockedIp, parseIPv4 } from './ssrf.js';

describe('isBlockedIp', () => {
  const blocked = [
    ['loopback v4', '127.0.0.1'],
    ['loopback net', '127.255.255.255'],
    ['unspecified v4', '0.0.0.0'],
    ['RFC1918 10', '10.0.0.1'],
    ['RFC1918 172.16', '172.16.0.1'],
    ['RFC1918 172.31', '172.31.255.255'],
    ['RFC1918 192.168', '192.168.1.1'],
    ['link-local', '169.254.169.254'],
    ['CGNAT', '100.64.0.1'],
    ['IPv6 loopback', '::1'],
    ['IPv6 unspecified', '::'],
    ['IPv6 ULA', 'fd12:3456:789a::1'],
    ['IPv6 link-local', 'fe80::1'],
    ['mapped loopback dotted', '::ffff:127.0.0.1'],
    ['mapped RFC1918 hex', '::ffff:c0a8:0001'],
    ['mapped loopback hex', '::ffff:7f00:1'],
  ] as const;

  for (const [label, ip] of blocked) {
    it(`rejects ${label} (${ip})`, () => {
      expect(isBlockedIp(ip)).toBe(true);
    });
  }

  const allowed = ['1.1.1.1', '8.8.8.8', '2001:4860:4860::8888', '64.233.160.0'];
  for (const ip of allowed) {
    it(`allows public ${ip}`, () => {
      expect(isBlockedIp(ip)).toBe(false);
    });
  }

  it('rejects unparseable addresses', () => {
    expect(isBlockedIp('not-an-ip')).toBe(true);
    expect(isBlockedIp('999.1.1.1')).toBe(true);
  });

  it('parses dotted IPv4', () => {
    expect(parseIPv4('127.0.0.1')).toBe(((127 << 24) >>> 0) | (0 << 16) | (0 << 8) | 1);
  });
});

describe('isBlockedHostname', () => {
  it('rejects metadata names', () => {
    expect(isBlockedHostname('metadata')).toBe(true);
    expect(isBlockedHostname('metadata.google.internal')).toBe(true);
    expect(isBlockedHostname('METADATA.GOOGLE.INTERNAL')).toBe(true);
  });

  it('allows ordinary hostnames', () => {
    expect(isBlockedHostname('example.com')).toBe(false);
    expect(isBlockedHostname('mock-target')).toBe(false);
  });
});
