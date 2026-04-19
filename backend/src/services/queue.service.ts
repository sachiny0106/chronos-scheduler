import { getRedisClient } from '../lib/redis';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('queue');

export const STREAM_KEY = 'job_queue';
export const GROUP_NAME = 'workers';
export const DUE_JOBS_KEY = 'due_jobs';

export async function ensureConsumerGroup(): Promise<void> {
  const redis = getRedisClient();
  try {
    await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '$', 'MKSTREAM');
    log.info('consumer group created');
  } catch (err: any) {
    if (!err.message?.includes('BUSYGROUP')) throw err;
    // BUSYGROUP = already exists, fine
  }
}

export async function enqueueJob(jobId: string, priority: number = 5): Promise<string> {
  const redis = getRedisClient();
  const messageId = await redis.xadd(STREAM_KEY, '*', 'jobId', jobId, 'priority', String(priority));
  return messageId!;
}

export async function removeDueJob(jobId: string): Promise<void> {
  await getRedisClient().zrem(DUE_JOBS_KEY, jobId);
}

export async function getDueJobs(batchSize: number): Promise<string[]> {
  return getRedisClient().zrangebyscore(DUE_JOBS_KEY, '-inf', String(Date.now()), 'LIMIT', 0, batchSize);
}

export async function ackMessage(messageId: string): Promise<void> {
  await getRedisClient().xack(STREAM_KEY, GROUP_NAME, messageId);
}
