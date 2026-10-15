import type { IncomingMessage, Server, ServerResponse } from 'node:http';

export function handleRequest(req: IncomingMessage, res: ServerResponse): void;
export function createMockTargetServer(): Server;
export function listenMockTarget(port?: number, host?: string): Promise<{ server: Server; port: number }>;
