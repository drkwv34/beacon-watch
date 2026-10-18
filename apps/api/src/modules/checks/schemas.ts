import { z } from 'zod';

export const ListChecksQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
