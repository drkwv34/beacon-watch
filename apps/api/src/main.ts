import { createPool, migrate } from '@beacon-watch/db';
import { buildApp } from './app.js';
import { createRedis } from './cache/redis-cache.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
await migrate(pool);
const redis = createRedis({
  url: config.REDIS_URL,
  connectTimeoutMs: config.REDIS_CONNECT_TIMEOUT_MS,
  commandTimeoutMs: config.REDIS_COMMAND_TIMEOUT_MS,
});
try {
  await redis.connect();
} catch {
  // Cache degrades; public limiter fails closed per request.
}
const app = await buildApp(config, { pool, redis });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app
      .close()
      .then(async () => {
        await redis.quit().catch(() => redis.disconnect());
        await pool.end();
        process.exit(0);
      })
      .catch(() => process.exit(1));
  });
}

await app.listen({ host: config.API_HOST, port: config.API_PORT });
