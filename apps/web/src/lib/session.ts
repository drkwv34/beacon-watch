import { cookies } from 'next/headers';
import { apiBaseUrl } from './env';

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
