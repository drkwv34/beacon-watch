import { DomainError } from './errors.js';
import { isBlockedHostname } from './ssrf.js';

export const HTTP_METHODS = ['GET', 'HEAD', 'POST'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const TARGET_NAME_MIN = 1;
export const TARGET_NAME_MAX = 100;
export const INTERVAL_MIN = 30;
export const INTERVAL_MAX = 3600;
export const INTERVAL_DEFAULT = 60;
export const TIMEOUT_MIN = 500;
export const TIMEOUT_MAX = 10_000;
export const TIMEOUT_DEFAULT = 5000;
export const EXPECTED_STATUS_DEFAULT = 200;
export const BODY_MAX_BYTES = 8192;
export const HEADERS_MAX_BYTES = 8192;
export const HEADERS_MAX_COUNT = 32;
export const THRESHOLD_MIN = 1;
export const THRESHOLD_MAX = 10;
export const THRESHOLD_DEFAULT = 2;
export const MAX_TARGETS_PER_USER = 50;
export const PUBLIC_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function isHttpMethod(value: unknown): value is HttpMethod {
  return typeof value === 'string' && (HTTP_METHODS as readonly string[]).includes(value);
}

export type TargetHeaders = Readonly<Record<string, string>>;

export interface TargetInput {
  name: string;
  url: string;
  method?: HttpMethod | undefined;
  interval_seconds?: number | undefined;
  timeout_ms?: number | undefined;
  expected_status?: number | undefined;
  headers?: TargetHeaders | null | undefined;
  body?: string | null | undefined;
  grace_threshold?: number | undefined;
  recovery_threshold?: number | undefined;
  enabled?: boolean | undefined;
  is_public?: boolean | undefined;
  public_slug?: string | null | undefined;
}

export type TargetPatch = {
  [K in keyof TargetInput]?: TargetInput[K] | undefined;
};

export interface ValidatedTarget {
  name: string;
  url: string;
  method: HttpMethod;
  interval_seconds: number;
  timeout_ms: number;
  expected_status: number;
  headers: TargetHeaders | null;
  body: string | null;
  grace_threshold: number;
  recovery_threshold: number;
  enabled: boolean;
  is_public: boolean;
  public_slug: string | null;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function parseHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new DomainError('VALIDATION_FAILED', 'Invalid target', {
      fields: { url: 'must be a valid http or https URL' },
    });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new DomainError('VALIDATION_FAILED', 'Invalid target', { fields: { url: 'must use http or https' } });
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new DomainError('VALIDATION_FAILED', 'Invalid target', { fields: { url: 'must not include userinfo' } });
  }
  if (!parsed.hostname) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid target', { fields: { url: 'must include a hostname' } });
  }
  if (parsed.port) {
    const port = Number(parsed.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid target', { fields: { url: 'port must be 1–65535' } });
    }
  }
  return parsed;
}

function validateHeaders(
  headers: TargetHeaders | null | undefined,
  fields: Record<string, string>,
): TargetHeaders | null {
  if (headers === undefined || headers === null) return null;
  const keys = Object.keys(headers);
  if (keys.length > HEADERS_MAX_COUNT) {
    fields.headers = `at most ${HEADERS_MAX_COUNT} headers`;
    return null;
  }
  for (const [name, value] of Object.entries(headers)) {
    if (name.length === 0 || name.length > 256 || /[\r\n]/.test(name)) {
      fields.headers = 'invalid header name';
      return null;
    }
    if (typeof value !== 'string' || value.length > 1024 || /[\r\n]/.test(value)) {
      fields.headers = 'invalid header value';
      return null;
    }
  }
  if (utf8Bytes(JSON.stringify(headers)) > HEADERS_MAX_BYTES) {
    fields.headers = `must be at most ${HEADERS_MAX_BYTES} bytes`;
    return null;
  }
  return headers;
}

export function validateTargetInput(input: TargetInput, options?: { partial?: boolean }): ValidatedTarget {
  const partial = options?.partial === true;
  const fields: Record<string, string> = {};

  const name = input.name;
  if (!partial || name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < TARGET_NAME_MIN || name.trim().length > TARGET_NAME_MAX) {
      fields.name = `must be ${TARGET_NAME_MIN}–${TARGET_NAME_MAX} characters`;
    }
  }

  let url = input.url;
  if (!partial || url !== undefined) {
    if (typeof url !== 'string') {
      fields.url = 'must be a valid http or https URL';
    } else {
      try {
        const parsed = parseHttpUrl(url);
        url = parsed.href;
        if (isBlockedHostname(parsed.hostname)) {
          fields.url = 'host is not allowed';
        }
      } catch (err) {
        if (err instanceof DomainError && err.details && typeof err.details['fields'] === 'object') {
          Object.assign(fields, err.details['fields'] as Record<string, string>);
        } else {
          fields.url = 'must be a valid http or https URL';
        }
      }
    }
  }

  let method: HttpMethod = input.method ?? 'GET';
  if (!partial || input.method !== undefined) {
    if (!isHttpMethod(method)) {
      fields.method = 'must be GET, HEAD, or POST';
      method = 'GET';
    }
  }

  const interval = input.interval_seconds ?? INTERVAL_DEFAULT;
  if (!partial || input.interval_seconds !== undefined) {
    if (!Number.isInteger(interval) || interval < INTERVAL_MIN || interval > INTERVAL_MAX) {
      fields.interval_seconds = `must be an integer ${INTERVAL_MIN}–${INTERVAL_MAX}`;
    }
  }

  const timeout = input.timeout_ms ?? TIMEOUT_DEFAULT;
  if (!partial || input.timeout_ms !== undefined) {
    if (!Number.isInteger(timeout) || timeout < TIMEOUT_MIN || timeout > TIMEOUT_MAX) {
      fields.timeout_ms = `must be an integer ${TIMEOUT_MIN}–${TIMEOUT_MAX}`;
    }
  }

  const expected = input.expected_status ?? EXPECTED_STATUS_DEFAULT;
  if (!partial || input.expected_status !== undefined) {
    if (!Number.isInteger(expected) || expected < 100 || expected > 599) {
      fields.expected_status = 'must be an integer 100–599';
    }
  }

  const headers = validateHeaders(input.headers, fields);

  const body: string | null = input.body === undefined ? null : input.body;
  if (!partial || input.body !== undefined) {
    if (body !== null) {
      if (method !== 'POST') {
        fields.body = 'is only allowed for POST';
      } else if (typeof body !== 'string' || utf8Bytes(body) > BODY_MAX_BYTES) {
        fields.body = `must be at most ${BODY_MAX_BYTES} bytes`;
      }
    }
  }

  const grace = input.grace_threshold ?? THRESHOLD_DEFAULT;
  if (!partial || input.grace_threshold !== undefined) {
    if (!Number.isInteger(grace) || grace < THRESHOLD_MIN || grace > THRESHOLD_MAX) {
      fields.grace_threshold = `must be an integer ${THRESHOLD_MIN}–${THRESHOLD_MAX}`;
    }
  }

  const recovery = input.recovery_threshold ?? THRESHOLD_DEFAULT;
  if (!partial || input.recovery_threshold !== undefined) {
    if (!Number.isInteger(recovery) || recovery < THRESHOLD_MIN || recovery > THRESHOLD_MAX) {
      fields.recovery_threshold = `must be an integer ${THRESHOLD_MIN}–${THRESHOLD_MAX}`;
    }
  }

  let publicSlug: string | null = input.public_slug === undefined ? null : input.public_slug;
  if (!partial || input.public_slug !== undefined) {
    if (publicSlug !== null && publicSlug !== '') {
      if (!PUBLIC_SLUG_RE.test(publicSlug)) {
        fields.public_slug = 'must be a lowercase slug of 1–64 characters';
      }
    } else {
      publicSlug = null;
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid target', { fields });
  }

  return {
    name: typeof name === 'string' ? name.trim() : name,
    url,
    method,
    interval_seconds: interval,
    timeout_ms: timeout,
    expected_status: expected,
    headers,
    body,
    grace_threshold: grace,
    recovery_threshold: recovery,
    enabled: input.enabled ?? true,
    is_public: input.is_public ?? false,
    public_slug: publicSlug,
  };
}
