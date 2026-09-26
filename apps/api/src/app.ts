import Fastify, { type FastifyInstance } from 'fastify';
import { isDomainError, type ErrorCode } from '@beacon-watch/domain';
import type { ApiConfig } from './config.js';

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

export function buildApp(config: Pick<ApiConfig, 'LOG_LEVEL'>): FastifyInstance {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL, redact: REDACT_PATHS },
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: 'x-request-id',
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

  return app;
}
