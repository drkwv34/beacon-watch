import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupFunction } from 'node:net';
import {
  PROBE_BODY_MAX_BYTES,
  PROBE_MAX_REDIRECTS,
  PROBE_USER_AGENT,
  connectTimeoutMs,
  isBlockedHostname,
  isBlockedIp,
  parseHttpUrl,
  parseIPv4,
  truncateErrorMessage,
  type HttpMethod,
  type ProbeErrorCode,
  type TargetHeaders,
} from '@beacon-watch/domain';
import { Agent, request } from 'undici';

export interface ProbeTarget {
  url: string;
  method: HttpMethod;
  timeoutMs: number;
  expectedStatus: number;
  headers: TargetHeaders | null;
  body: string | null;
}

export interface ProbeOutcome {
  success: boolean;
  statusCode: number | null;
  latencyMs: number;
  errorCode: ProbeErrorCode | null;
  errorMessage: string | null;
}

export type AddressLookup = (hostname: string) => Promise<string[]>;

export interface ProbeClient {
  probe(target: ProbeTarget): Promise<ProbeOutcome>;
}

export interface ProbeClientOptions {
  ssrfProtection: boolean;
  insecureTls: boolean;
  lookup?: AddressLookup;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function defaultLookup(hostname: string): Promise<string[]> {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

function isIpLiteral(hostname: string): boolean {
  if (parseIPv4(hostname) !== null) return true;
  return hostname.includes(':');
}

function headerValue(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0];
  return direct;
}

function buildHeaders(target: ProbeTarget): Record<string, string> {
  const headers: Record<string, string> = {};
  if (target.headers) {
    for (const [name, value] of Object.entries(target.headers)) {
      if (name.toLowerCase() === 'user-agent') continue;
      headers[name] = value;
    }
  }
  headers['user-agent'] = PROBE_USER_AGENT;
  return headers;
}

function failed(
  errorCode: ProbeErrorCode,
  latencyMs: number,
  errorMessage: string,
  statusCode: number | null = null,
): ProbeOutcome {
  return {
    success: false,
    statusCode,
    latencyMs,
    errorCode,
    errorMessage: truncateErrorMessage(errorMessage) ?? errorCode,
  };
}

function causeChain(err: unknown): unknown[] {
  const out: unknown[] = [];
  let current: unknown = err;
  const seen = new Set<unknown>();
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    out.push(current);
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return out;
}

function errorCodeOf(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string') return err.code;
  return '';
}

function errorNameOf(err: unknown): string {
  if (err instanceof Error) return err.name;
  return '';
}

function errorMessageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function classifyProbeError(err: unknown): ProbeErrorCode {
  for (const item of causeChain(err)) {
    const code = errorCodeOf(item);
    const name = errorNameOf(item);
    if (name === 'TimeoutError' || name === 'AbortError' || code === 'ABORT_ERR' || code === 'UND_ERR_ABORTED') {
      return 'TIMEOUT';
    }
    if (
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      code === 'UND_ERR_HEADERS_TIMEOUT' ||
      code === 'UND_ERR_BODY_TIMEOUT' ||
      code === 'ETIMEDOUT'
    ) {
      return 'TIMEOUT';
    }
    if (
      code === 'ENOTFOUND' ||
      code === 'ENODATA' ||
      code === 'EAI_AGAIN' ||
      code === 'EAI_NONAME' ||
      code === 'UND_ERR_DNS'
    ) {
      return 'DNS';
    }
    if (
      code.startsWith('ERR_TLS') ||
      code.startsWith('CERT_') ||
      code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
      code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' ||
      code === 'ERR_SSL_WRONG_VERSION_NUMBER' ||
      name === 'TLSSocketError'
    ) {
      return 'TLS';
    }
    if (code === 'UND_ERR_INVALID_ARG') {
      return 'INTERNAL';
    }
    if (
      code === 'ECONNREFUSED' ||
      code === 'ECONNRESET' ||
      code === 'EHOSTUNREACH' ||
      code === 'ENETUNREACH' ||
      code === 'ECONNABORTED' ||
      code === 'UND_ERR_SOCKET' ||
      code === 'UND_ERR_CONNECT'
    ) {
      return 'CONNECT';
    }
  }
  const message = errorMessageOf(err).toLowerCase();
  if (message.includes('timeout') || message.includes('aborted')) return 'TIMEOUT';
  if (message.includes('certificate') || message.includes('ssl') || message.includes('tls')) return 'TLS';
  if (message.includes('getaddrinfo') || message.includes('dns')) return 'DNS';
  return 'CONNECT';
}

async function consumeCappedBody(body: { dump: (opts: { limit: number }) => Promise<void> }): Promise<void> {
  try {
    await body.dump({ limit: PROBE_BODY_MAX_BYTES });
  } catch {
    // Timeout or abort while discarding the rest of the body is not a separate failure.
  }
}

function pinLookup(addresses: string[]): LookupFunction {
  const primary = addresses[0]!;
  const family = primary.includes(':') ? 6 : 4;
  return ((_hostname, _options, callback) => {
    callback(null, primary, family);
  }) as LookupFunction;
}

export async function inspectProbeUrl(
  raw: string,
  protection: boolean,
  lookup: AddressLookup,
): Promise<{ url: URL; addresses: string[] } | ProbeOutcome> {
  let url: URL;
  try {
    url = parseHttpUrl(raw);
  } catch {
    return failed('SSRF_BLOCKED', 0, 'url is not a permitted http(s) target');
  }
  if (isBlockedHostname(url.hostname)) {
    return failed('SSRF_BLOCKED', 0, 'host is not allowed');
  }
  if (!protection) {
    return { url, addresses: [] };
  }
  if (isIpLiteral(url.hostname)) {
    if (isBlockedIp(url.hostname)) {
      return failed('SSRF_BLOCKED', 0, 'address is not allowed');
    }
    return { url, addresses: [url.hostname] };
  }
  let addresses: string[];
  try {
    addresses = await lookup(url.hostname);
  } catch (err) {
    return failed('DNS', 0, errorMessageOf(err));
  }
  if (addresses.length === 0) {
    return failed('DNS', 0, 'hostname did not resolve');
  }
  for (const address of addresses) {
    if (isBlockedIp(address)) {
      return failed('SSRF_BLOCKED', 0, 'address is not allowed');
    }
  }
  return { url, addresses };
}

export function createProbeClient(options: ProbeClientOptions): ProbeClient {
  const lookup = options.lookup ?? defaultLookup;

  return {
    async probe(target: ProbeTarget): Promise<ProbeOutcome> {
      const started = performance.now();
      const latency = (): number => Math.max(0, Math.round(performance.now() - started));
      const signal = AbortSignal.timeout(target.timeoutMs);

      let currentUrl = target.url;
      let method = target.method;
      let body: string | null = target.method === 'POST' ? target.body : null;
      let redirects = 0;

      try {
        while (true) {
          const safety = await inspectProbeUrl(currentUrl, options.ssrfProtection, lookup);
          if ('errorCode' in safety) {
            return { ...safety, latencyMs: latency() };
          }

          const connect: {
            timeout: number;
            rejectUnauthorized: boolean;
            lookup?: LookupFunction;
          } = {
            timeout: connectTimeoutMs(target.timeoutMs),
            rejectUnauthorized: !options.insecureTls,
          };
          if (safety.addresses.length > 0) {
            connect.lookup = pinLookup(safety.addresses);
          }
          const agent = new Agent({
            connections: 1,
            connect,
          });

          try {
            const response = await request(safety.url.href, {
              method,
              headers: buildHeaders(target),
              ...(method === 'POST' && body ? { body } : {}),
              dispatcher: agent,
              signal,
            });

            const statusCode = response.statusCode;
            if (REDIRECT_STATUSES.has(statusCode)) {
              const location = headerValue(response.headers, 'location');
              await consumeCappedBody(response.body);
              if (!location) {
                return failed('CONNECT', latency(), 'redirect without location', statusCode);
              }
              redirects += 1;
              if (redirects > PROBE_MAX_REDIRECTS) {
                return failed('REDIRECT_LIMIT', latency(), 'too many redirects', statusCode);
              }
              currentUrl = new URL(location, safety.url).href;
              if (statusCode === 303 || ((statusCode === 301 || statusCode === 302) && method === 'POST')) {
                method = 'GET';
                body = null;
              }
              continue;
            }

            await consumeCappedBody(response.body);
            const latencyMs = latency();
            if (statusCode === target.expectedStatus) {
              return {
                success: true,
                statusCode,
                latencyMs,
                errorCode: null,
                errorMessage: null,
              };
            }
            return failed('UNEXPECTED_STATUS', latencyMs, `status ${statusCode}`, statusCode);
          } finally {
            await agent.close();
          }
        }
      } catch (err) {
        if (signal.aborted) {
          return failed('TIMEOUT', latency(), errorMessageOf(err));
        }
        return failed(classifyProbeError(err), latency(), errorMessageOf(err));
      }
    },
  };
}
