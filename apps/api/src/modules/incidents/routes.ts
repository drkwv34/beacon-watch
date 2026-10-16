import type { FastifyInstance } from 'fastify';
import { DomainError } from '@beacon-watch/domain';
import type { IncidentService } from './service.js';

export async function registerIncidentRoutes(app: FastifyInstance, incidents: IncidentService): Promise<void> {
  app.get('/targets/:id/incidents', async (request) => {
    const user = request.authUser;
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Authentication required');
    const { id } = request.params as { id: string };
    const items = await incidents.listForTarget(user.id, id);
    return { items };
  });
}
