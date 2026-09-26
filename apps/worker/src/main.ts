import { pino } from 'pino';
import { loadConfig } from './config.js';

const config = loadConfig();
const log = pino({ level: config.LOG_LEVEL, base: { service: 'worker' } });

log.info(
  {
    ssrf_protection: config.SSRF_PROTECTION,
    probe_max_concurrency: config.PROBE_MAX_CONCURRENCY,
    probe_max_per_host: config.PROBE_MAX_PER_HOST,
  },
  'worker scaffold started; scheduler not implemented yet',
);

const heartbeat = setInterval(() => log.debug('heartbeat'), 60_000);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    log.info({ signal }, 'shutting down');
    clearInterval(heartbeat);
    process.exit(0);
  });
}
