import { createPool, migrate } from '@beacon-watch/db';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
await migrate(pool);
const app = await buildApp(config, { pool });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app
      .close()
      .then(async () => {
        await pool.end();
        process.exit(0);
      })
      .catch(() => process.exit(1));
  });
}

await app.listen({ host: config.API_HOST, port: config.API_PORT });
