// Zero-dependency on purpose: the image must stay tiny and boot instantly in CI.
// Failure/slow/flap admin endpoints arrive with the scheduler (Day 3) and demo script (Day 8).
import { createServer } from 'node:http';

const port = Number(process.env.MOCK_TARGET_PORT ?? 8080);

const server = createServer((req, res) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok' }));
      return;
    }
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(port, () => {
  console.log(JSON.stringify({ level: 'info', service: 'mock-target', port, msg: 'listening' }));
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
