import { createPool, migrate } from '@beacon-watch/db';
import { pino } from 'pino';
import { loadConfig } from './config.js';
import { runScheduler, sleep } from './modules/scheduling/run-check.js';
import { HostSemaphore, Semaphore } from './pool/semaphore.js';
import { createProbeClient } from './probe/client.js';

const config = loadConfig();
const log = pino({ level: config.LOG_LEVEL, base: { service: 'worker' } });
const pool = createPool(config.DATABASE_URL);
await migrate(pool);

const probe = createProbeClient({
  ssrfProtection: config.SSRF_PROTECTION,
  insecureTls: config.PROBE_INSECURE_TLS,
});

const abort = new AbortController();

log.info(
  {
    ssrf_protection: config.SSRF_PROTECTION,
    probe_max_concurrency: config.PROBE_MAX_CONCURRENCY,
    probe_max_per_host: config.PROBE_MAX_PER_HOST,
  },
  'worker started',
);

const loop = runScheduler(
  {
    pool,
    probe,
    log,
    global: new Semaphore(config.PROBE_MAX_CONCURRENCY),
    perHost: new HostSemaphore(config.PROBE_MAX_PER_HOST),
    now: () => new Date(),
    random: Math.random,
    sleep,
    pollMs: config.SCHEDULER_POLL_MS,
  },
  abort.signal,
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    log.info({ signal }, 'shutting down');
    abort.abort();
    void pool.end().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}

process.on('unhandledRejection', (err) => {
  log.fatal({ err }, 'unhandled rejection');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'uncaught exception');
  process.exit(1);
});

await loop;
