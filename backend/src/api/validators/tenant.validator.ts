import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  rateLimit: z
    .object({
      maxJobsPerMinute: z.number().int().min(1).max(10000).default(100),
    })
    .default({ maxJobsPerMinute: 100 }),
  webhookUrl: z.string().url().optional().refine(
    (url) => {
      if (!url) return true;
      try {
        const parsed = new URL(url);
        // Block internal/private IPs (SSRF prevention)
        const host = parsed.hostname;
        if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host)) return false;
        if (host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.')) return false;
        if (parsed.protocol !== 'https:') return false;
        return true;
      } catch { return false; }
    },
    { message: 'webhookUrl must be a public HTTPS URL' }
  ),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
