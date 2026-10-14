import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '@beacon-watch/domain';
import { cookieBase, CSRF_COOKIE, SESSION_COOKIE } from '../../cookies.js';
import type { ApiConfig } from '../../config.js';
import { parseBody } from '../../parse.js';
import { csrfMatches, type AuthService } from './service.js';
import { LoginBody, RegisterBody } from './schemas.js';

function setSessionCookies(
  reply: FastifyReply,
  config: ApiConfig,
  session: { token: string; csrf: string; expiresAt: Date },
): void {
  reply.setCookie(SESSION_COOKIE, session.token, cookieBase(config, true, session.expiresAt));
  reply.setCookie(CSRF_COOKIE, session.csrf, cookieBase(config, false, session.expiresAt));
}

function clearSessionCookies(reply: FastifyReply, config: ApiConfig): void {
  const expires = new Date(0);
  reply.clearCookie(SESSION_COOKIE, cookieBase(config, true, expires));
  reply.clearCookie(CSRF_COOKIE, cookieBase(config, false, expires));
}

export async function registerPublicAuthRoutes(
  app: FastifyInstance,
  auth: AuthService,
  config: ApiConfig,
): Promise<void> {
  app.post('/auth/register', async (request, reply) => {
    const body = parseBody(RegisterBody, request.body);
    try {
      const session = await auth.register(body);
      setSessionCookies(reply, config, session);
      return reply.status(201).send({ user: { id: session.user.id, email: session.user.email } });
    } catch (err) {
      if (err instanceof DomainError && err.code === 'VALIDATION_FAILED') throw err;
      throw err;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const body = parseBody(LoginBody, request.body);
    const session = await auth.login(body);
    setSessionCookies(reply, config, session);
    return reply.status(200).send({ user: { id: session.user.id, email: session.user.email } });
  });
}

export async function registerProtectedAuthRoutes(
  app: FastifyInstance,
  auth: AuthService,
  config: ApiConfig,
): Promise<void> {
  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await auth.logout(token);
    clearSessionCookies(reply, config);
    return reply.status(204).send();
  });

  app.get('/auth/me', async (request) => {
    const user = request.authUser;
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Authentication required');
    return { user: { id: user.id, email: user.email } };
  });
}

export function assertCsrf(request: FastifyRequest): void {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  const cookie = request.cookies[CSRF_COOKIE];
  const header = request.headers['x-csrf-token'];
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (!csrfMatches(cookie, headerValue)) {
    throw new DomainError('FORBIDDEN', 'CSRF token mismatch');
  }
}
