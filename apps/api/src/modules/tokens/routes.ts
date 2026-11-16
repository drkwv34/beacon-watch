import type { FastifyInstance, FastifyRequest } from 'fastify';
import { DomainError } from '@beacon-watch/domain';
import { parseBody } from '../../parse.js';
import type { AuthUser } from '../auth/service.js';
import { CreateTokenBody } from './schemas.js';
import type { TokenService } from './service.js';

function requireSessionUser(request: FastifyRequest): AuthUser {
  if (!request.authUser) throw new DomainError('UNAUTHENTICATED', 'Authentication required');
  if (request.authMethod !== 'session') throw new DomainError('FORBIDDEN', 'Session required');
  return request.authUser;
}

export async function registerTokenRoutes(app: FastifyInstance, tokens: TokenService): Promise<void> {
  app.post('/tokens', async (request, reply) => {
    const user = requireSessionUser(request);
    const body = parseBody(CreateTokenBody, request.body);
    const created = await tokens.create(user.id, body);
    return reply.status(201).send(created);
  });

  app.get('/tokens', async (request) => {
    const user = requireSessionUser(request);
    const items = await tokens.list(user.id);
    return { items };
  });

  app.delete('/tokens/:id', async (request, reply) => {
    const user = requireSessionUser(request);
    const { id } = request.params as { id: string };
    await tokens.revoke(user.id, id);
    return reply.status(204).send();
  });
}
