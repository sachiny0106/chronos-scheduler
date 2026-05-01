import { z } from 'zod';

export const createJobSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['one-time', 'delayed', 'cron']),
  cronExpression: z.string().optional(),
  payload: z.record(z.any()).default({}).refine(
    (val) => JSON.stringify(val).length <= 65536,
    { message: 'Payload too large (max 64KB)' }
  ),
  priority: z.number().int().min(1).max(10).default(5),
  runAt: z.coerce.date(),
  maxRetries: z.number().int().min(0).max(20).default(3),
  retryBackoff: z.enum(['fixed', 'exponential']).default('exponential'),
  idempotencyKey: z.string().max(500).optional(),
  timeout: z.number().int().min(1000).max(600000).default(30000), // 1s - 10min
}).refine(
  (data) => {
    if (data.type === 'cron' && !data.cronExpression) {
      return false;
    }
    return true;
  },
  { message: 'cronExpression is required for cron jobs', path: ['cronExpression'] }
);

export type CreateJobInput = z.infer<typeof createJobSchema>;
