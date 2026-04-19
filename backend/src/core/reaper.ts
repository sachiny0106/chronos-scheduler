import { Job, JobStatus } from '../models/job.model';
import { transitionJob } from './state-machine';
import { handleJobFailure } from './retry-strategy';
import { LeaderElection } from './leader-election';
import { config } from '../config';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('reaper');

// Detects stuck RUNNING jobs (worker crashed, stale heartbeat) and fails them.
export class Reaper {
  private leader: LeaderElection;
  private timer: NodeJS.Timeout | null = null;

  constructor(leader: LeaderElection) {
    this.leader = leader;
  }

  start(): void {
    this.timer = setInterval(() => this.sweep(), config.worker.reaperIntervalMs);
    log.info({ intervalMs: config.worker.reaperIntervalMs }, 'started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async sweep(): Promise<void> {
    if (!this.leader.isLeader) return;

    try {
      // 3 missed heartbeats = considered dead
      const cutoff = new Date(Date.now() - config.worker.heartbeatIntervalMs * 3);

      const staleJobs = await Job.find({
        status: JobStatus.RUNNING,
        lastHeartbeat: { $lt: cutoff },
      }).limit(50); // cap to avoid huge sweeps

      if (staleJobs.length === 0) return;

      log.warn({ count: staleJobs.length }, 'reaping stale jobs');

      for (const job of staleJobs) {
        const id = job._id.toString();
        const failed = await transitionJob(id, JobStatus.RUNNING, JobStatus.FAILED);

        if (failed) {
          log.warn({ jobId: id, workerId: job.workerId }, 'reaped');
          await handleJobFailure(id);
        }
      }
    } catch (err: any) {
      log.error({ err: err.message }, 'sweep error');
    }
  }
}
