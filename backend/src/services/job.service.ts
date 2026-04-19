import { Types } from 'mongoose';
import { Job, IJob, JobStatus, JobType } from '../models/job.model';
import { ExecutionLog } from '../models/execution-log.model';
import { transitionJob } from '../core/state-machine';
import { claimIdempotencyKey, releaseIdempotencyKey } from '../core/idempotency';
import { getRedisClient } from '../lib/redis';
import { DUE_JOBS_KEY } from './queue.service';
import { createChildLogger } from '../lib/logger';
import { CreateJobInput } from '../api/validators/job.validator';

const log = createChildLogger('job-service');

export async function createJob(tenantId: string, input: CreateJobInput): Promise<IJob> {
  const jobId = new Types.ObjectId();

  // Idempotency: if key already claimed, return existing job
  if (input.idempotencyKey) {
    const existingId = await claimIdempotencyKey(tenantId, input.idempotencyKey, jobId.toString());
    if (existingId) {
      const existing = await Job.findById(existingId);
      if (existing) return existing;
      // Original was deleted — fall through to create new
    }
  }

  try {
    const job = await Job.create({
      _id: jobId,
      tenantId,
      ...input,
      status: JobStatus.PENDING,
    });

    // Atomically PENDING → SCHEDULED via state machine
    const scheduled = await transitionJob(jobId.toString(), JobStatus.PENDING, JobStatus.SCHEDULED);
    if (!scheduled) throw new Error('failed to schedule job');

    // Add to sorted set for the scheduler to pick up when due
    const redis = getRedisClient();
    await redis.zadd(DUE_JOBS_KEY, new Date(input.runAt).getTime(), jobId.toString());

    log.info({ jobId: job._id, name: job.name, runAt: job.runAt }, 'created');
    return scheduled;
  } catch (err) {
    if (input.idempotencyKey) {
      await releaseIdempotencyKey(tenantId, input.idempotencyKey).catch(() => {});
    }
    throw err;
  }
}

export async function getJobById(jobId: string, tenantId: string): Promise<IJob | null> {
  if (!Types.ObjectId.isValid(jobId)) return null;
  return Job.findOne({ _id: jobId, tenantId });
}

export async function listJobs(
  tenantId: string,
  filters: { status?: JobStatus; type?: JobType; limit?: number; offset?: number }
): Promise<{ jobs: IJob[]; total: number }> {
  const query: Record<string, any> = { tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;

  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;

  const [jobs, total] = await Promise.all([
    Job.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
    Job.countDocuments(query),
  ]);

  return { jobs, total };
}

export async function deleteJob(jobId: string, tenantId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(jobId)) return false;

  const deleted = await Job.findOneAndDelete({
    _id: jobId,
    tenantId,
    status: { $in: [JobStatus.PENDING, JobStatus.SCHEDULED] },
  });

  if (deleted) {
    await getRedisClient().zrem(DUE_JOBS_KEY, jobId);
    // Clean up idempotency key if present
    if (deleted.idempotencyKey) {
      await releaseIdempotencyKey(deleted.tenantId.toString(), deleted.idempotencyKey).catch(() => {});
    }
    log.info({ jobId }, 'deleted');
  }

  return !!deleted;
}

export async function getJobExecutions(jobId: string) {
  if (!Types.ObjectId.isValid(jobId)) return [];
  return ExecutionLog.find({ jobId }).sort({ startedAt: -1 });
}

export async function listDeadLetterJobs(tenantId: string): Promise<IJob[]> {
  return Job.find({ tenantId, status: JobStatus.DEAD_LETTER }).sort({ updatedAt: -1 });
}

export async function retryDeadLetterJob(jobId: string, tenantId: string): Promise<IJob | null> {
  if (!Types.ObjectId.isValid(jobId)) return null;

  // Verify ownership before any state change
  const job = await Job.findOne({ _id: jobId, tenantId, status: JobStatus.DEAD_LETTER });
  if (!job) return null;

  const pending = await transitionJob(jobId, JobStatus.DEAD_LETTER, JobStatus.PENDING, {
    retryCount: 0,
    runAt: new Date(),
    workerId: undefined,
    executionId: undefined,
    lastHeartbeat: undefined,
  });

  if (!pending) return null;

  // PENDING → SCHEDULED
  const scheduled = await transitionJob(jobId, JobStatus.PENDING, JobStatus.SCHEDULED);
  if (!scheduled) return null;

  await getRedisClient().zadd(DUE_JOBS_KEY, Date.now(), jobId);
  log.info({ jobId }, 'DLQ job re-enqueued');
  return scheduled;
}
