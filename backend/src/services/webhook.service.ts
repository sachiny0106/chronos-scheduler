import crypto from 'crypto';
import { Tenant } from '../models/tenant.model';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('webhook');

interface WebhookPayload {
  event: 'job.completed' | 'job.failed' | 'job.dead_letter';
  jobId: string;
  tenantId: string;
  name: string;
  status: string;
  timestamp: string;
  executionId?: string;
  workerId?: string;
  duration?: number;
  error?: string;
}

export async function deliverWebhook(tenantId: string, payload: WebhookPayload): Promise<void> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant?.webhookUrl) return;

  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', tenant.apiKey).update(body).digest('hex');

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(tenant.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Chronos-Signature': signature,
          'X-Chronos-Event': payload.event,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        log.info({ tenantId, event: payload.event, jobId: payload.jobId }, 'webhook delivered');
        return;
      }

      log.warn({ tenantId, status: res.status, attempt }, 'webhook rejected');
    } catch (err: any) {
      log.warn({ tenantId, attempt, err: err.message }, 'webhook delivery failed');
    }

    // Backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }

  log.error({ tenantId, event: payload.event, jobId: payload.jobId }, 'webhook exhausted retries');
}
