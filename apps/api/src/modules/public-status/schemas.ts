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
  check_count: z.number().int().nonnegative(),
  ever_succeeded: z.boolean(),
  recent_incidents: z.array(
    z.object({
      opened_at: z.string(),
      resolved_at: z.string().nullable(),
      duration_seconds: z.number().int().nonnegative(),
      status: z.enum(['open', 'resolved']),
    }),
  ),
});

export type PublicStatusBody = z.infer<typeof PublicStatusBody>;
