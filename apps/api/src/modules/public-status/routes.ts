import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '@beacon-watch/domain';
import type { RateLimiter } from '../../cache/rate-limiter.js';
import type { PublicStatusService } from './service.js';

function requestOrigin(request: FastifyRequest): string | undefined {
  const origin = request.headers.origin;
  return typeof origin === 'string' && origin.length > 0 ? origin : undefined;
}

function applyPublicCors(request: FastifyRequest, reply: FastifyReply, allowlist: string[]): void {
  void reply.header('Vary', 'Origin');
  const origin = requestOrigin(request);
  if (origin && allowlist.includes(origin)) {
    void reply.header('Access-Control-Allow-Origin', origin);
  }
}

export async function registerPublicStatusRoutes(
  app: FastifyInstance,
  deps: {
    service: PublicStatusService;
    rateLimiter: RateLimiter | undefined;
    corsOrigins: string[];
    now: () => Date;
  },
): Promise<void> {
  app.addHook('onRequest', async (request, reply) => {
    applyPublicCors(request, reply, deps.corsOrigins);
    if (request.method === 'OPTIONS') return;
    if (!deps.rateLimiter) {
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Rate limiter unavailable');
    }
    const decision = await deps.rateLimiter.consume(request.ip, deps.now());
    void reply.header('X-RateLimit-Limit', String(decision.limit));
    void reply.header('X-RateLimit-Remaining', String(decision.remaining));
    if (!decision.allowed) {
      void reply.header('Retry-After', String(decision.retryAfterSeconds));
      throw new DomainError('RATE_LIMITED', 'Too many requests');
    }
  });

  app.options('/status/:slug', async (_request, reply) => {
    void reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    void reply.header('Access-Control-Max-Age', '600');
    return reply.code(204).send();
  });

  app.get('/status/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    return deps.service.getBySlug(slug);
  });
}
