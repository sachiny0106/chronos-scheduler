import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  rateLimit: z
    .object({
      maxJobsPerMinute: z.number().int().min(1).max(10000).default(100),
    })
    .default({ maxJobsPerMinute: 100 }),
  webhookUrl: z.string().url().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
