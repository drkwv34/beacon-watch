import { z } from 'zod';

const booleanFromEnv = z.enum(['true', 'false']).transform((value) => value === 'true');

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SSRF_PROTECTION: booleanFromEnv.default(true),
  PROBE_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(200).default(20),
  PROBE_MAX_PER_HOST: z.coerce.number().int().min(1).max(20).default(2),
});

export type WorkerConfig = z.infer<typeof ConfigSchema>;

/** Fails fast at boot with a readable list of invalid keys; never logs values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid worker configuration: ${keys}`);
  }
  return parsed.data;
}
