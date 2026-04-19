import { LeaderElection } from './leader-election';
import { transitionJob } from './state-machine';
import { getDueJobs, removeDueJob, enqueueJob, ensureConsumerGroup } from '../services/queue.service';
import { Job, JobStatus } from '../models/job.model';
import { config } from '../config';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('scheduler');

export class SchedulerLoop {
  private leader: LeaderElection;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(leader: LeaderElection) {
    this.leader = leader;
  }

  async start(): Promise<void> {
    await ensureConsumerGroup();
    this.timer = setInterval(() => this.tick(), config.scheduler.pollIntervalMs);
    log.info({ intervalMs: config.scheduler.pollIntervalMs }, 'started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (!this.leader.isLeader || this.running) return;
    this.running = true;

    try {
      const dueJobIds = await getDueJobs(config.scheduler.batchSize);
      if (dueJobIds.length === 0) return;

      log.info({ count: dueJobIds.length }, 'processing due jobs');

      await Promise.all(dueJobIds.map((id) => this.enqueueOne(id)));
    } catch (err: any) {
      log.error({ err: err.message }, 'tick error');
    } finally {
      this.running = false;
    }
  }

  private async enqueueOne(jobId: string): Promise<void> {
    const job = await Job.findById(jobId);

    if (!job) {
      await removeDueJob(jobId);
      return;
    }

    // Handle both fresh jobs (SCHEDULED) and retried jobs landing back as SCHEDULED
    if (job.status === JobStatus.PENDING) {
      const scheduled = await transitionJob(jobId, JobStatus.PENDING, JobStatus.SCHEDULED);
      if (!scheduled) { await removeDueJob(jobId); return; }
    }

    if (job.status !== JobStatus.SCHEDULED && job.status !== JobStatus.PENDING) {
      // Job already moved past SCHEDULED (race with another scheduler), clean up
      await removeDueJob(jobId);
      return;
    }

    const queued = await transitionJob(jobId, JobStatus.SCHEDULED, JobStatus.QUEUED);
    if (!queued) { await removeDueJob(jobId); return; }

    await enqueueJob(jobId, job.priority);
    await removeDueJob(jobId);

    log.debug({ jobId, name: job.name }, 'enqueued');
  }
}
