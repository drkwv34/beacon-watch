import { z } from 'zod';

export const RegisterBody = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(1024),
});

export const LoginBody = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(1024),
});

export type RegisterBody = z.infer<typeof RegisterBody>;
export type LoginBody = z.infer<typeof LoginBody>;
