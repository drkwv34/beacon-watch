import type { AuthUser } from './modules/auth/service.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
    authMethod?: 'session' | 'bearer';
  }
}

export {};
