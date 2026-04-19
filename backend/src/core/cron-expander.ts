import { parseExpression } from 'cron-parser';
import { Job, IJob, JobStatus, JobType } from '../models/job.model';
import { getRedisClient } from '../lib/redis';
import { DUE_JOBS_KEY } from '../services/queue.service';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('cron-expander');

/**
 * Compute the next run time from a cron expression.
 */
export function getNextCronRunTime(cronExpression: string, fromDate: Date = new Date()): Date {
  const interval = parseExpression(cronExpression, { currentDate: fromDate });
  return interval.next().toDate();
}

/**
 * After a cron job completes, schedule the next occurrence.
 * Creates a new job instance linked to the parent via parentJobId.
 */
export async function scheduleNextCronRun(completedJob: IJob): Promise<IJob | null> {
  if (completedJob.type !== JobType.CRON || !completedJob.cronExpression) {
    return null;
  }

  const nextRunAt = getNextCronRunTime(completedJob.cronExpression);

  const nextJob = await Job.create({
    tenantId: completedJob.tenantId,
    name: completedJob.name,
    type: JobType.CRON,
    cronExpression: completedJob.cronExpression,
    payload: completedJob.payload,
    status: JobStatus.SCHEDULED,
    priority: completedJob.priority,
    runAt: nextRunAt,
    maxRetries: completedJob.maxRetries,
    retryBackoff: completedJob.retryBackoff,
    timeout: completedJob.timeout,
    parentJobId: completedJob.parentJobId || completedJob._id,
  });

  // Add to sorted set for scheduler
  const redis = getRedisClient();
  await redis.zadd(DUE_JOBS_KEY, nextRunAt.getTime(), nextJob._id.toString());

  log.info(
    { parentJobId: completedJob._id, nextJobId: nextJob._id, nextRunAt },
    'Next cron run scheduled'
  );

  return nextJob;
}
