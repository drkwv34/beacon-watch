import 'server-only';
import { redirect } from 'next/navigation';
import { interpretMeStatus } from './me-status';
import { apiFetch } from './session';

export type SessionUser = { id: string; email: string };

export type DashboardSession =
  | { state: 'authenticated'; user: SessionUser }
  | { state: 'unauthenticated' }
  | { state: 'unavailable'; status: number; requestId: string };

export { interpretMeStatus };

export async function loadDashboardSession(): Promise<DashboardSession> {
  const res = await apiFetch('/api/v1/auth/me');
  const kind = interpretMeStatus(res.status);
  if (kind === 'unauthenticated') return { state: 'unauthenticated' };
  if (kind === 'unavailable') {
    return {
      state: 'unavailable',
      status: res.status,
      requestId: res.headers.get('x-request-id') ?? 'unknown',
    };
  }
  const body = (await res.json()) as { user: SessionUser };
  return { state: 'authenticated', user: body.user };
}

export async function requireDashboardSession(): Promise<
  { ok: true; user: SessionUser } | { ok: false; status: number; requestId: string }
> {
  const session = await loadDashboardSession();
  if (session.state === 'unauthenticated') redirect('/login');
  if (session.state === 'unavailable') {
    return { ok: false, status: session.status, requestId: session.requestId };
  }
  return { ok: true, user: session.user };
}
