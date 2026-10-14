import { HTTP_METHODS } from '@beacon-watch/domain';
import { z } from 'zod';

const HeadersSchema = z.record(z.string(), z.string()).nullable().optional();

export const CreateTargetBody = z.object({
  name: z.string(),
  url: z.string(),
  method: z.enum(HTTP_METHODS).optional(),
  interval_seconds: z.number().int().optional(),
  timeout_ms: z.number().int().optional(),
  expected_status: z.number().int().optional(),
  headers: HeadersSchema,
  body: z.string().nullable().optional(),
  grace_threshold: z.number().int().optional(),
  recovery_threshold: z.number().int().optional(),
  enabled: z.boolean().optional(),
  is_public: z.boolean().optional(),
  public_slug: z.string().nullable().optional(),
});

export const UpdateTargetBody = CreateTargetBody.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'at least one field is required',
});

export const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type CreateTargetBody = z.infer<typeof CreateTargetBody>;
export type UpdateTargetBody = z.infer<typeof UpdateTargetBody>;
