import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import { DomainError, isDomainError, type ErrorCode } from '@beacon-watch/domain';
import type { DbPool } from '@beacon-watch/db';
import { RedisCache } from './cache/redis-cache.js';
import { RedisRateLimiter, type RateLimiter } from './cache/rate-limiter.js';
import type { ApiConfig } from './config.js';
import { SESSION_COOKIE } from './cookies.js';
import { systemLookup, type LookupFn } from './lookup.js';
import { AuthService } from './modules/auth/service.js';
import { assertCsrf, registerProtectedAuthRoutes, registerPublicAuthRoutes } from './modules/auth/routes.js';
import { PublicStatusService } from './modules/public-status/service.js';
import { registerPublicStatusRoutes } from './modules/public-status/routes.js';
import { TargetService } from './modules/targets/service.js';
import { registerTargetRoutes } from './modules/targets/routes.js';
import { CheckService } from './modules/checks/service.js';
import { registerCheckRoutes } from './modules/checks/routes.js';
import { IncidentService } from './modules/incidents/service.js';
import { registerIncidentRoutes } from './modules/incidents/routes.js';

export const REDACT_PATHS = ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  DEPENDENCY_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export interface ErrorBody {
  error: { code: ErrorCode; message: string; request_id: string; details?: Record<string, unknown> };
}

export interface AppDeps {
  pool: DbPool;
  lookup?: LookupFn;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
  redis?: Redis;
  cache?: RedisCache;
  rateLimiter?: RateLimiter;
}

export async function buildApp(
  config: Pick<ApiConfig, 'LOG_LEVEL'> & Partial<ApiConfig>,
  deps?: AppDeps,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL, redact: REDACT_PATHS },
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: 'x-request-id',
    trustProxy: config.TRUST_PROXY ?? false,
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.setErrorHandler((err, request, reply) => {
    if (isDomainError(err)) {
      const status = STATUS_BY_CODE[err.code];
      const level = status >= 500 ? 'error' : 'info';
      request.log[level]({ err_code: err.code }, err.message);
      const body: ErrorBody = {
        error: {
          code: err.code,
          message: err.message,
          request_id: request.id,
          ...(err.details && { details: { ...err.details } }),
        },
      };
      return reply.status(status).send(body);
    }
    const fastifyErr = err as { statusCode?: unknown; message?: unknown };
    const status =
      typeof fastifyErr.statusCode === 'number' && fastifyErr.statusCode < 500 ? fastifyErr.statusCode : 500;
    if (status === 500) request.log.error({ err }, 'unhandled error');
    const body: ErrorBody = {
      error: {
        code: status === 400 ? 'VALIDATION_FAILED' : 'INTERNAL',
        message:
          status === 500 || typeof fastifyErr.message !== 'string' ? 'Internal server error' : fastifyErr.message,
        request_id: request.id,
      },
    };
    return reply.status(status).send(body);
  });

  app.setNotFoundHandler((request, reply) => {
    const body: ErrorBody = { error: { code: 'NOT_FOUND', message: 'Route not found', request_id: request.id } };
    return reply.status(404).send(body);
  });

  app.get('/healthz', async () => ({ status: 'ok' }));

  if (deps) {
    const fullConfig = config as ApiConfig;
    const lookup = deps.lookup ?? systemLookup;
    const now = deps.now ?? (() => new Date());
    const cache =
      deps.cache ??
      (deps.redis ? new RedisCache(deps.redis, { warn: (obj, msg) => app.log.warn(obj, msg) }) : undefined);
    const rateLimiter =
      deps.rateLimiter ??
      (deps.redis ? new RedisRateLimiter(deps.redis, fullConfig.PUBLIC_RATE_LIMIT_PER_MIN) : undefined);
    const auth = new AuthService(deps.pool, fullConfig, now, deps.randomBytes);
    const targets = new TargetService(deps.pool, fullConfig, lookup, now, cache);
    const checks = new CheckService(deps.pool);
    const incidents = new IncidentService(deps.pool, now);
    const publicStatus = new PublicStatusService(deps.pool, cache, now);

    app.get('/readyz', async () => {
      try {
        await deps.pool.query('SELECT 1');
      } catch {
        throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Postgres is unavailable');
      }
      const redisOk = cache ? await cache.ping() : false;
      if (!redisOk) {
        return { status: 'degraded', postgres: 'ok', redis: 'unavailable' };
      }
      return { status: 'ok', postgres: 'ok', redis: 'ok' };
    });

    await app.register(
      async (v1) => {
        await v1.register(cookie);
        await registerPublicAuthRoutes(v1, auth, fullConfig);

        await v1.register(async (protectedApi) => {
          protectedApi.addHook('preHandler', async (request) => {
            const token = request.cookies[SESSION_COOKIE];
            const session = await auth.resolveSession(token);
            if (!session) {
              throw new DomainError('UNAUTHENTICATED', 'Authentication required');
            }
            request.authUser = session.user;
          });
          protectedApi.addHook('preHandler', async (request) => {
            assertCsrf(request);
          });
          await registerProtectedAuthRoutes(protectedApi, auth, fullConfig);
          await registerTargetRoutes(protectedApi, targets);
          await registerCheckRoutes(protectedApi, checks);
          await registerIncidentRoutes(protectedApi, incidents);
          protectedApi.all('/*', async () => {
            throw new DomainError('NOT_FOUND', 'Route not found');
          });
        });
      },
      { prefix: '/api/v1' },
    );

    await app.register(
      async (pub) => {
        await registerPublicStatusRoutes(pub, {
          service: publicStatus,
          rateLimiter,
          corsOrigins: fullConfig.PUBLIC_CORS_ORIGINS,
          now,
        });
      },
      { prefix: '/api/public/v1' },
    );
  }

  return app;
}
