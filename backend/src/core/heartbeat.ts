import { Job } from '../models/job.model';
import { config } from '../config';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('heartbeat');

export class Heartbeat {
  private jobId: string;
  private timer: NodeJS.Timeout | null = null;

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  start(): void {
    this.timer = setInterval(async () => {
      try {
        await Job.updateOne({ _id: this.jobId }, { $set: { lastHeartbeat: new Date() } });
      } catch (err: any) {
        log.error({ jobId: this.jobId, err: err.message }, 'heartbeat failed');
      }
    }, config.worker.heartbeatIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
