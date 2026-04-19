import { Job, IJob, JobStatus } from '../models/job.model';
import { publishJobEvent } from '../services/event.service';
import { jobTransitions } from '../lib/metrics';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('state-machine');

/*
 *  PENDING ──▶ SCHEDULED ──▶ QUEUED ──▶ RUNNING ──▶ COMPLETED
 *                                          │
 *                                          ▼
 *                                        FAILED ──▶ RETRYING ──▶ SCHEDULED
 *                                          │                        (back to sorted set)
 *                                          ▼
 *                                      DEAD_LETTER ──▶ PENDING (manual retry)
 */
const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.PENDING]:     [JobStatus.SCHEDULED],
  [JobStatus.SCHEDULED]:   [JobStatus.QUEUED],
  [JobStatus.QUEUED]:      [JobStatus.RUNNING],
  [JobStatus.RUNNING]:     [JobStatus.COMPLETED, JobStatus.FAILED],
  [JobStatus.COMPLETED]:   [],
  [JobStatus.FAILED]:      [JobStatus.RETRYING, JobStatus.DEAD_LETTER],
  [JobStatus.RETRYING]:    [JobStatus.SCHEDULED],
  [JobStatus.DEAD_LETTER]: [JobStatus.PENDING],
};

export function isValidTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Atomically transition a job using findOneAndUpdate with status precondition.
 * Returns null if another process already transitioned it (no double-execution).
 */
export async function transitionJob(
  jobId: string,
  fromStatus: JobStatus,
  toStatus: JobStatus,
  extraFields: Record<string, any> = {}
): Promise<IJob | null> {
  if (!isValidTransition(fromStatus, toStatus)) {
    log.warn({ jobId, from: fromStatus, to: toStatus }, 'invalid transition');
    return null;
  }

  const result = await Job.findOneAndUpdate(
    { _id: jobId, status: fromStatus },
    { $set: { status: toStatus, ...extraFields } },
    { new: true }
  );

  if (!result) {
    log.debug({ jobId, from: fromStatus, to: toStatus }, 'transition skipped (precondition failed)');
    return null;
  }

  log.info({ jobId, from: fromStatus, to: toStatus }, 'transition');
  jobTransitions.inc({ from: fromStatus, to: toStatus });

  // fire-and-forget event publish — don't block the transition
  publishJobEvent({
    jobId,
    tenantId: result.tenantId.toString(),
    from: fromStatus,
    to: toStatus,
    timestamp: new Date().toISOString(),
    workerId: result.workerId,
  }).catch(() => {});

  return result;
}
