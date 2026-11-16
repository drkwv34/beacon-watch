import { z } from 'zod';

export const CreateTokenBody = z.object({
  label: z.string().trim().min(1).max(100),
  expires_at: z.string().optional(),
});

export type CreateTokenBody = z.infer<typeof CreateTokenBody>;
