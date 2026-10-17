import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { DomainError } from '@beacon-watch/domain';
import type { RateLimiter } from '../../cache/rate-limiter.js';
import type { PublicStatusService } from './service.js';

export async function registerPublicStatusRoutes(
  app: FastifyInstance,
  deps: {
    service: PublicStatusService;
    rateLimiter: RateLimiter | undefined;
    corsOrigins: string[];
    now: () => Date;
  },
): Promise<void> {
  await app.register(cors, {
    origin: deps.corsOrigins.length === 0 ? false : deps.corsOrigins,
  });

  app.addHook('onRequest', async (request, reply) => {
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

  app.get('/status/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    return deps.service.getBySlug(slug);
  });
}
