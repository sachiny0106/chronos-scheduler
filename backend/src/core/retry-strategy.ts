import { Job, JobStatus, RetryBackoff } from '../models/job.model';
import { transitionJob } from './state-machine';
import { getRedisClient } from '../lib/redis';
import { DUE_JOBS_KEY } from '../services/queue.service';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('retry');

const BASE_DELAY_MS = 5000;
const MAX_DELAY_MS = 300_000; // 5 min cap

export function getNextDelay(retryCount: number, strategy: RetryBackoff): number {
  if (strategy === RetryBackoff.FIXED) return BASE_DELAY_MS;

  // Exponential: 5s, 10s, 20s, 40s... + jitter to avoid thundering herd
  const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
  const jitter = delay * (0.1 + Math.random() * 0.1);
  return Math.min(delay + jitter, MAX_DELAY_MS);
}

export async function handleJobFailure(jobId: string): Promise<void> {
  const job = await Job.findById(jobId);
  if (!job || job.status !== JobStatus.FAILED) return;

  if (job.retryCount < job.maxRetries) {
    const delay = getNextDelay(job.retryCount, job.retryBackoff);
    const nextRunAt = new Date(Date.now() + delay);

    // FAILED → RETRYING (with incremented count and new runAt)
    const retrying = await transitionJob(jobId, JobStatus.FAILED, JobStatus.RETRYING, {
      retryCount: job.retryCount + 1,
      runAt: nextRunAt,
      workerId: undefined,
      executionId: undefined,
      lastHeartbeat: undefined,
    });

    if (!retrying) return;

    // RETRYING → SCHEDULED (goes back to sorted set for the scheduler)
    const scheduled = await transitionJob(jobId, JobStatus.RETRYING, JobStatus.SCHEDULED);
    if (!scheduled) return;

    await getRedisClient().zadd(DUE_JOBS_KEY, nextRunAt.getTime(), jobId);

    log.info({ jobId, attempt: job.retryCount + 1, max: job.maxRetries, delay }, 'retry scheduled');
  } else {
    // Exhausted retries → DLQ
    await transitionJob(jobId, JobStatus.FAILED, JobStatus.DEAD_LETTER);
    log.warn({ jobId, attempts: job.retryCount }, 'moved to DLQ');
  }
}
