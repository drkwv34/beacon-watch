import { cookies } from 'next/headers';
import { apiBaseUrl } from './env';

/** Forwards the request cookie jar to the API. Session validity is GET /api/v1/auth/me, never a local decode. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const jar = await cookies();
  const headers = new Headers(init.headers);
  const cookie = jar.toString();
  if (cookie && !headers.has('cookie')) headers.set('cookie', cookie);
  return fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
    signal: init.signal ?? AbortSignal.timeout(5000),
  });
}
