import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classifyProbeError, createProbeClient, inspectProbeUrl, type ProbeTarget } from './client.js';
import { listenMockTarget } from '../../../../mock-target/src/server.js';

let baseUrl = '';
let closeServer: () => Promise<void> = async () => undefined;

beforeAll(async () => {
  const { server, port } = await listenMockTarget(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${port}`;
  closeServer = () =>
    new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
});

afterAll(async () => {
  await closeServer();
});

function target(overrides: Partial<ProbeTarget> = {}): ProbeTarget {
  return {
    url: `${baseUrl}/health`,
    method: 'GET',
    timeoutMs: 2000,
    expectedStatus: 200,
    headers: null,
    body: null,
    ...overrides,
  };
}

describe('probe client', () => {
  const client = createProbeClient({ ssrfProtection: false, insecureTls: false });

  it('succeeds when TCP works and the status matches expected_status', async () => {
    const result = await client.probe(target());
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.errorCode).toBeNull();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('maps a mismatched status to UNEXPECTED_STATUS', async () => {
    const result = await client.probe(target({ url: `${baseUrl}/status/500` }));
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.errorCode).toBe('UNEXPECTED_STATUS');
  });

  it('times out the mock-target slow endpoint without hanging', async () => {
    const started = Date.now();
    const result = await client.probe(target({ url: `${baseUrl}/slow?ms=5000`, timeoutMs: 500 }));
    const elapsed = Date.now() - started;
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TIMEOUT');
    expect(elapsed).toBeLessThan(3000);
  });

  it('classifies an oversized body by status after capping the read', async () => {
    const result = await client.probe(target({ url: `${baseUrl}/large` }));
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it('follows three redirects and fails on the fourth', async () => {
    const ok = await client.probe(target({ url: `${baseUrl}/redirect/3` }));
    expect(ok.success).toBe(true);
    const limited = await client.probe(target({ url: `${baseUrl}/redirect/4` }));
    expect(limited.success).toBe(false);
    expect(limited.errorCode).toBe('REDIRECT_LIMIT');
  });

  it('sends User-Agent beacon-watch/1.0 even if the target tries to override it', async () => {
    const result = await client.probe(
      target({
        headers: { 'User-Agent': 'not-beacon', 'X-Test': '1' },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('blocks private DNS answers when SSRF protection is on', async () => {
    const protectedClient = createProbeClient({
      ssrfProtection: true,
      insecureTls: false,
      lookup: async () => ['10.0.0.1'],
    });
    const result = await protectedClient.probe(target({ url: 'http://evil.example/health' }));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('SSRF_BLOCKED');
  });

  it('blocks loopback and RFC1918 literals when SSRF protection is on', async () => {
    const protectedClient = createProbeClient({ ssrfProtection: true, insecureTls: false });
    for (const url of ['http://127.0.0.1/health', 'http://10.0.0.1/health', 'http://192.168.1.1/health']) {
      const blocked = await protectedClient.probe(target({ url }));
      expect(blocked.success, url).toBe(false);
      expect(blocked.errorCode, url).toBe('SSRF_BLOCKED');
    }
  });

  it('blocks a redirect from the demo host to metadata, loopback, and RFC1918 without a second hop', async () => {
    const port = new URL(baseUrl).port;
    const requested: string[] = [];
    const composeLike = createProbeClient({
      ssrfProtection: true,
      insecureTls: false,
      hostException: ['mock-target'],
      lookup: async (hostname) => {
        if (hostname === 'mock-target') return ['127.0.0.1'];
        throw new Error(`unexpected lookup ${hostname}`);
      },
      onRequest: (href) => {
        requested.push(href);
      },
    });

    for (const dest of ['http://169.254.169.254/', 'http://127.0.0.1/', 'http://10.0.0.1/', 'http://192.168.1.1/']) {
      requested.length = 0;
      const url = `http://mock-target:${port}/redirect-to?url=${encodeURIComponent(dest)}`;
      const result = await composeLike.probe(target({ url, timeoutMs: 800 }));
      expect(result.success, dest).toBe(false);
      expect(result.errorCode, dest).toBe('SSRF_BLOCKED');
      expect(requested, dest).toEqual([url]);
      expect(
        requested.some((href) => href.startsWith(dest)),
        dest,
      ).toBe(false);
    }
  });

  it('allows the demo host and still pins mixed-DNS public hosts', async () => {
    const port = new URL(baseUrl).port;
    let lookups = 0;
    const composeLike = createProbeClient({
      ssrfProtection: true,
      insecureTls: false,
      hostException: ['mock-target'],
      lookup: async (hostname) => {
        lookups += 1;
        if (hostname === 'mock-target') return ['127.0.0.1'];
        throw new Error(`unexpected lookup ${hostname}`);
      },
    });
    const ok = await composeLike.probe(target({ url: `http://mock-target:${port}/health` }));
    expect(ok.success).toBe(true);
    expect(lookups).toBe(1);

    const mixed = createProbeClient({
      ssrfProtection: true,
      insecureTls: false,
      lookup: async () => ['8.8.8.8', '10.0.0.1'],
      onRequest: () => {
        throw new Error('must not dial mixed DNS');
      },
    });
    const blocked = await mixed.probe(target({ url: 'http://mixed.example/health' }));
    expect(blocked.errorCode).toBe('SSRF_BLOCKED');
  });
});

describe('inspectProbeUrl', () => {
  it('rejects a redirect hop to a private address', async () => {
    const hop = await inspectProbeUrl('http://10.0.0.1/metadata', true, async () => ['10.0.0.1']);
    expect('errorCode' in hop && hop.errorCode === 'SSRF_BLOCKED').toBe(true);
  });

  it('does not inherit a hostname exception onto the next hop', async () => {
    const allowed = await inspectProbeUrl('http://mock-target:8080/health', true, async () => ['172.18.0.4'], [
      'mock-target',
    ]);
    expect('url' in allowed).toBe(true);

    for (const hop of ['http://169.254.169.254/', 'http://127.0.0.1/', 'http://10.0.0.1/']) {
      const blocked = await inspectProbeUrl(hop, true, async () => ['8.8.8.8'], ['mock-target']);
      expect('errorCode' in blocked && blocked.errorCode === 'SSRF_BLOCKED', hop).toBe(true);
    }
  });
});

describe('classifyProbeError', () => {
  it('maps DNS, TLS, connect, and timeout codes', () => {
    expect(classifyProbeError(Object.assign(new Error('dns'), { code: 'ENOTFOUND' }))).toBe('DNS');
    expect(classifyProbeError(Object.assign(new Error('cert'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }))).toBe(
      'TLS',
    );
    expect(classifyProbeError(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }))).toBe('CONNECT');
    const timeout = new Error('aborted');
    timeout.name = 'TimeoutError';
    expect(classifyProbeError(timeout)).toBe('TIMEOUT');
  });
});
