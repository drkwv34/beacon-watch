import { apiBaseUrl } from '../../../lib/env';

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  const incoming = new URL(request.url);
  const target = `${apiBaseUrl()}/api/${path.join('/')}${incoming.search}`;
  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  const csrf = request.headers.get('x-csrf-token');
  if (csrf) headers.set('x-csrf-token', csrf);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const method = request.method;
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();
  const upstream = await fetch(target, {
    method,
    headers,
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(5000),
  });
  const out = new Headers();
  const setCookie = upstream.headers.getSetCookie();
  for (const value of setCookie) out.append('set-cookie', value);
  const ct = upstream.headers.get('content-type');
  if (ct) out.set('content-type', ct);
  const requestId = upstream.headers.get('x-request-id');
  if (requestId) out.set('x-request-id', requestId);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
