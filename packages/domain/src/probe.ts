export const PROBE_ERROR_CODES = [
  'TIMEOUT',
  'DNS',
  'TLS',
  'CONNECT',
  'UNEXPECTED_STATUS',
  'SSRF_BLOCKED',
  'REDIRECT_LIMIT',
  'INTERNAL',
] as const;

export type ProbeErrorCode = (typeof PROBE_ERROR_CODES)[number];

export const ERROR_MESSAGE_MAX = 500;
export const PROBE_BODY_MAX_BYTES = 4096;
export const PROBE_MAX_REDIRECTS = 3;
export const PROBE_CONNECT_TIMEOUT_MAX_MS = 2000;
export const PROBE_USER_AGENT = 'beacon-watch/1.0';

export function isProbeErrorCode(value: unknown): value is ProbeErrorCode {
  return typeof value === 'string' && (PROBE_ERROR_CODES as readonly string[]).includes(value);
}

export function truncateErrorMessage(message: string | null | undefined): string | null {
  if (message === undefined || message === null || message.length === 0) return null;
  return message.length <= ERROR_MESSAGE_MAX ? message : message.slice(0, ERROR_MESSAGE_MAX);
}

export function connectTimeoutMs(timeoutMs: number): number {
  return Math.min(PROBE_CONNECT_TIMEOUT_MAX_MS, timeoutMs);
}
