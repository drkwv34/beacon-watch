import { z } from 'zod';

const WebConfigSchema = z.object({
  API_BASE_URL: z.string().min(1).default('http://localhost:4000'),
});

const StatusDbConfigSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

export type WebConfig = z.infer<typeof WebConfigSchema>;
export type StatusDbConfig = z.infer<typeof StatusDbConfigSchema>;

type EnvMap = Record<string, string | undefined>;

/** Dashboard HTTP client. Does not require DATABASE_URL. */
export function loadWebConfig(env: EnvMap = process.env): WebConfig {
  const parsed = WebConfigSchema.safeParse(env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid web configuration: ${keys}`);
  }
  return parsed.data;
}

/** Server-only SSR reader. Reads DATABASE_URL, never NEXT_PUBLIC_DATABASE_URL. */
export function loadStatusDbConfig(env: EnvMap = process.env): StatusDbConfig {
  const parsed = StatusDbConfigSchema.safeParse(env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid web status database configuration: ${keys}`);
  }
  return parsed.data;
}
