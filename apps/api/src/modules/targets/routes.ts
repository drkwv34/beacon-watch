import type { FastifyInstance } from 'fastify';
import { DomainError } from '@beacon-watch/domain';
import { toPublicTarget } from '@beacon-watch/db';
import { parseBody } from '../../parse.js';
import { CreateTargetBody, ListQuery, UpdateTargetBody } from './schemas.js';
import type { TargetService } from './service.js';

export async function registerTargetRoutes(app: FastifyInstance, targets: TargetService): Promise<void> {
  app.post('/targets', async (request, reply) => {
    const user = request.authUser;
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Authentication required');
    const body = parseBody(CreateTargetBody, request.body);
    const row = await targets.create(user.id, body);
    return reply.status(201).send(toPublicTarget(row, { latencyMs: null }));
  });

  app.get('/targets', async (request) => {
    const user = request.authUser;
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Authentication required');
    const query = parseBody(ListQuery, request.query);
    const items = await targets.list(user.id, query.limit);
    return { items, next_cursor: null };
  });

  app.get('/targets/:id', async (request) => {
    const user = request.authUser;
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Authentication required');
    const { id } = request.params as { id: string };
    return targets.get(user.id, id);
  });

  app.post('/targets/:id/check-now', async (request) => {
    const user = request.authUser;
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Authentication required');
    const { id } = request.params as { id: string };
    return targets.checkNow(user.id, id);
  });

  app.patch('/targets/:id', async (request) => {
    const user = request.authUser;
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Authentication required');
    const { id } = request.params as { id: string };
    const body = parseBody(UpdateTargetBody, request.body);
    const row = await targets.update(user.id, id, body);
    return toPublicTarget(row);
  });

  app.delete('/targets/:id', async (request, reply) => {
    const user = request.authUser;
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Authentication required');
    const { id } = request.params as { id: string };
    await targets.remove(user.id, id);
    return reply.status(204).send();
  });
}
