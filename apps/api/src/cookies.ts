import type { CookieSerializeOptions } from '@fastify/cookie';
import type { ApiConfig } from './config.js';

export const SESSION_COOKIE = 'beacon_session';
export const CSRF_COOKIE = 'beacon_csrf';

export function cookieBase(
  config: Pick<ApiConfig, 'NODE_ENV'>,
  httpOnly: boolean,
  expires: Date,
): CookieSerializeOptions {
  return {
    path: '/',
    httpOnly,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    expires,
  };
}
