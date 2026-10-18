import type { FastifyInstance } from 'fastify';
import { DomainError } from '@beacon-watch/domain';
import { parseBody } from '../../parse.js';
import { ListChecksQuery } from './schemas.js';
import type { CheckService } from './service.js';

export async function registerCheckRoutes(app: FastifyInstance, checks: CheckService): Promise<void> {
  app.get('/targets/:id/checks', async (request) => {
    const user = request.authUser;
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Authentication required');
    const { id } = request.params as { id: string };
    const query = parseBody(ListChecksQuery, request.query);
    const items = await checks.listForTarget(user.id, id, query.limit);
    return { items };
  });
}
