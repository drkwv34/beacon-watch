const METADATA_HOSTS = new Set(['metadata', 'metadata.google.internal']);

/** Hostnames that must never be probed, regardless of DNS. */
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (METADATA_HOSTS.has(host)) return true;
  for (const blocked of METADATA_HOSTS) {
    if (host.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

export function parseIPv4(address: string): number | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (!match) return null;
  const octets = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
  if (octets.some((octet) => Number.isNaN(octet) || octet > 255)) return null;
  return ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0;
}

function isBlockedIPv4(ip: number): boolean {
  const octet1 = ip >>> 24;
  if (octet1 === 0 || octet1 === 10 || octet1 === 127) return true;
  if (ip >>> 16 === 0xa9fe) return true; // 169.254.0.0/16
  if (ip >>> 16 === 0xc0a8) return true; // 192.168.0.0/16
  if (ip >>> 20 === 0xac1) return true; // 172.16.0.0/12
  if (ip >>> 22 === 0x191) return true; // 100.64.0.0/10
  return false;
}

function expandIPv6(address: string): number[] | null {
  const lower = address.trim().toLowerCase();
  if (!lower.includes(':')) return null;
  if (lower.startsWith('[') && lower.endsWith(']')) return expandIPv6(lower.slice(1, -1));

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) {
    const v4 = parseIPv4(mapped[1]!);
    if (v4 === null) return null;
    return [0, 0, 0, 0, 0, 0xffff, v4 >>> 16, v4 & 0xffff];
  }

  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (mappedHex) {
    return [0, 0, 0, 0, 0, 0xffff, parseInt(mappedHex[1]!, 16), parseInt(mappedHex[2]!, 16)];
  }

  if ((lower.match(/::/g) ?? []).length > 1) return null;
  const [left, right] = lower.split('::');
  const leftParts = left && left.length > 0 ? left.split(':') : [];
  const rightParts = right && right.length > 0 ? right.split(':') : [];
  if (leftParts.some((p) => p.length > 4) || rightParts.some((p) => p.length > 4)) return null;
  const missing = 8 - leftParts.length - rightParts.length;
  if (missing < 0) return null;
  if (!lower.includes('::') && leftParts.length !== 8) return null;
  const parts = [...leftParts, ...Array.from({ length: missing }, () => '0'), ...rightParts];
  if (parts.length !== 8) return null;
  const words: number[] = [];
  for (const part of parts) {
    if (part.length === 0 || !/^[0-9a-f]{1,4}$/.test(part)) return null;
    words.push(parseInt(part, 16));
  }
  return words;
}

function isIpv4Mapped(words: number[]): number | null {
  const prefixZero = words.slice(0, 5).every((w) => w === 0);
  if (prefixZero && words[5] === 0xffff) {
    return ((words[6]! << 16) | words[7]!) >>> 0;
  }
  return null;
}

function isBlockedIPv6(words: number[]): boolean {
  const mapped = isIpv4Mapped(words);
  if (mapped !== null) return isBlockedIPv4(mapped);
  const allZero = words.every((w) => w === 0);
  if (allZero) return true; // ::
  if (allZero === false && words.slice(0, 7).every((w) => w === 0) && words[7] === 1) return true; // ::1
  const first = words[0]!;
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10
  return false;
}

/** True when the address must not be contacted under NFR-SEC-001. Unparseable input is blocked. */
export function isBlockedIp(address: string): boolean {
  const trimmed = address.trim().toLowerCase();
  const v4 = parseIPv4(trimmed);
  if (v4 !== null) return isBlockedIPv4(v4);
  const words = expandIPv6(trimmed);
  if (words === null) return true;
  return isBlockedIPv6(words);
}
