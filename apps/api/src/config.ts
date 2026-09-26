import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

export type ApiConfig = z.infer<typeof ConfigSchema>;

/** Fails fast at boot with a readable list of invalid keys; never logs values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid API configuration: ${keys}`);
  }
  return parsed.data;
}
