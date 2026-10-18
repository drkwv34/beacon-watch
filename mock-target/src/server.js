// Zero-dependency on purpose: the image must stay tiny and boot instantly in CI.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const LARGE_BODY = 'x'.repeat(8192);
let healthStatus = Number(process.env.MOCK_HEALTH_STATUS ?? 200);

function sendJson(res, status, body, method) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(method === 'HEAD' ? undefined : JSON.stringify(body));
}

export function handleRequest(req, res) {
  const url = new URL(req.url ?? '/', 'http://mock-target.local');
  const method = req.method ?? 'GET';

  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
    res.writeHead(405, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  if (url.pathname === '/admin/fail' && method === 'POST') {
    healthStatus = 500;
    sendJson(res, 200, { health: healthStatus }, method);
    return;
  }

  if (url.pathname === '/admin/ok' && method === 'POST') {
    healthStatus = 200;
    sendJson(res, 200, { health: healthStatus }, method);
    return;
  }

  if (url.pathname === '/ready') {
    sendJson(res, 200, { status: 'ready' }, method);
    return;
  }

  if (url.pathname === '/health') {
    const body = healthStatus === 200 ? { status: 'ok' } : { status: 'down' };
    sendJson(res, healthStatus, body, method);
    return;
  }

  if (url.pathname === '/slow') {
    const ms = Number(url.searchParams.get('ms') ?? '2000');
    const delay = Number.isFinite(ms) && ms >= 0 ? Math.min(ms, 30_000) : 2000;
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(method === 'HEAD' ? undefined : JSON.stringify({ status: 'slow', ms: delay }));
    }, delay);
    return;
  }

  const statusMatch = /^\/status\/(\d{3})$/.exec(url.pathname);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(method === 'HEAD' ? undefined : JSON.stringify({ status }));
    return;
  }

  const redirectMatch = /^\/redirect\/(\d+)$/.exec(url.pathname);
  if (redirectMatch) {
    const remaining = Number(redirectMatch[1]);
    if (remaining <= 0) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(302, { location: `/redirect/${remaining - 1}` });
    res.end();
    return;
  }

  if (url.pathname === '/large') {
    res.writeHead(200, { 'content-type': 'text/plain', 'content-length': String(LARGE_BODY.length) });
    res.end(method === 'HEAD' ? undefined : LARGE_BODY);
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
}

export function createMockTargetServer() {
  return createServer(handleRequest);
}

export function listenMockTarget(port = Number(process.env.MOCK_TARGET_PORT ?? 8080), host = '0.0.0.0') {
  const server = createMockTargetServer();
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address();
      const bound = typeof address === 'object' && address ? address.port : port;
      console.log(JSON.stringify({ level: 'info', service: 'mock-target', port: bound, msg: 'listening' }));
      resolve({ server, port: bound });
    });
  });
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const { server } = await listenMockTarget();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(() => process.exit(0)));
  }
}
