import { z } from 'zod';

export const PublicStatusBody = z.object({
  name: z.string(),
  status: z.enum(['up', 'down', 'unknown', 'paused']),
  last_checked_at: z.string().nullable(),
  latency_ms: z.number().int().nullable(),
  uptime_24h: z.number().min(0).max(1).nullable(),
  open_incident: z
    .object({
      opened_at: z.string(),
      duration_seconds: z.number().int().nonnegative(),
    })
    .nullable(),
});

export type PublicStatusBody = z.infer<typeof PublicStatusBody>;
