import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { createRedisClient } from '../lib/redis';
import { Job, JobStatus, JobType } from '../models/job.model';
import { ExecutionLog } from '../models/execution-log.model';
import { transitionJob } from './state-machine';
import { Heartbeat } from './heartbeat';
import { getHandler } from '../handlers/registry';
import { handleJobFailure } from './retry-strategy';
import { scheduleNextCronRun } from './cron-expander';
import { STREAM_KEY, GROUP_NAME, ackMessage, ensureConsumerGroup } from '../services/queue.service';
import { config } from '../config';
import { executionDuration, activeJobs as activeJobsGauge } from '../lib/metrics';
import { deliverWebhook } from '../services/webhook.service';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('worker');

export class WorkerPool {
  readonly workerId: string;
  private redis;
  private stopped = false;
  private activeJobs = 0;

  constructor() {
    this.workerId = `worker-${crypto.randomBytes(4).toString('hex')}`;
    this.redis = createRedisClient(`stream-${this.workerId}`);
  }

  async start(): Promise<void> {
    await this.redis.connect();
    await ensureConsumerGroup();

    log.info({ workerId: this.workerId, concurrency: config.worker.concurrency }, 'started');

    // Phase 1: recover unacked messages from previous crash
    await this.recoverPending();
    // Phase 2: consume new messages
    this.consumeLoop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    log.info({ workerId: this.workerId, activeJobs: this.activeJobs }, 'stopping');

    const deadline = Date.now() + config.worker.shutdownGracePeriodMs;
    while (this.activeJobs > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
    }

    if (this.activeJobs > 0) {
      log.warn({ activeJobs: this.activeJobs }, 'force-stopping with active jobs');
    }

    await this.redis.quit();
  }

  private async recoverPending(): Promise<void> {
    try {
      const pending = await this.redis.xreadgroup(
        'GROUP', GROUP_NAME, this.workerId,
        'COUNT', '10',
        'STREAMS', STREAM_KEY, '0'
      );

      if (!pending || pending.length === 0) return;

      const [, messages] = pending[0] as [string, [string, string[]][]];
      if (messages.length === 0) return;

      log.info({ count: messages.length }, 'recovering pending messages');

      for (const [messageId, fields] of messages) {
        const jobId = extractField(fields, 'jobId');
        if (jobId) await this.processJob(jobId, messageId);
      }
    } catch (err: any) {
      log.error({ err: err.message }, 'recovery error');
    }
  }

  private async consumeLoop(): Promise<void> {
    while (!this.stopped) {
      if (this.activeJobs >= config.worker.concurrency) {
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }

      try {
        const result = await this.redis.xreadgroup(
          'GROUP', GROUP_NAME, this.workerId,
          'COUNT', '1',
          'BLOCK', String(config.worker.blockTimeoutMs),
          'STREAMS', STREAM_KEY, '>'
        );

        if (!result || result.length === 0) continue;

        const [, messages] = result[0] as [string, [string, string[]][]];

        for (const [messageId, fields] of messages) {
          const jobId = extractField(fields, 'jobId');
          if (!jobId) continue;

          // Don't await — run concurrently up to concurrency limit
          this.processJob(jobId, messageId).catch((err) =>
            log.error({ jobId, err: err.message }, 'unhandled process error')
          );
        }
      } catch (err: any) {
        if (this.stopped) break;
        log.error({ err: err.message }, 'consume error');
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  private async processJob(jobId: string, messageId: string): Promise<void> {
    this.activeJobs++;
    activeJobsGauge.inc();
    const executionId = uuidv4();
    const startedAt = new Date();
    const heartbeat = new Heartbeat(jobId);

    try {
      // Atomic claim: only one worker wins this
      const claimed = await transitionJob(jobId, JobStatus.QUEUED, JobStatus.RUNNING, {
        workerId: this.workerId,
        executionId,
        lastHeartbeat: startedAt,
      });

      if (!claimed) {
        await ackMessage(messageId);
        return;
      }

      heartbeat.start();

      const job = (await Job.findById(jobId))!;
      const handler = getHandler(job.name);

      if (!handler) {
        heartbeat.stop();
        await this.fail(jobId, executionId, startedAt, messageId, new Error(`no handler: ${job.name}`));
        return;
      }

      const result = await withTimeout(handler(job.payload), job.timeout);

      heartbeat.stop();
      const finishedAt = new Date();
      const duration = finishedAt.getTime() - startedAt.getTime();

      await transitionJob(jobId, JobStatus.RUNNING, JobStatus.COMPLETED);

      await ExecutionLog.create({
        jobId, executionId,
        workerId: this.workerId,
        status: 'SUCCESS',
        startedAt, finishedAt, duration,
        result: result ?? undefined,
      });

      await ackMessage(messageId);

      // If this is a cron job, schedule the next run
      if (job.type === JobType.CRON && job.cronExpression) {
        await scheduleNextCronRun(job);
      }

      executionDuration.observe({ handler: job.name, status: 'SUCCESS' }, duration);

      // Fire-and-forget webhook
      deliverWebhook(job.tenantId.toString(), {
        event: 'job.completed', jobId, tenantId: job.tenantId.toString(),
        name: job.name, status: 'COMPLETED', timestamp: finishedAt.toISOString(),
        executionId, workerId: this.workerId, duration,
      }).catch(() => {});

      log.info({ jobId, name: job.name, duration }, 'completed');
    } catch (err: any) {
      heartbeat.stop();
      await this.fail(jobId, executionId, startedAt, messageId, err);
    } finally {
      this.activeJobs--;
      activeJobsGauge.dec();
    }
  }

  private async fail(
    jobId: string, executionId: string, startedAt: Date,
    messageId: string, err: Error
  ): Promise<void> {
    const finishedAt = new Date();

    await transitionJob(jobId, JobStatus.RUNNING, JobStatus.FAILED);

    await ExecutionLog.create({
      jobId, executionId,
      workerId: this.workerId,
      status: 'FAILURE',
      startedAt, finishedAt,
      duration: finishedAt.getTime() - startedAt.getTime(),
      error: { message: err.message, stack: err.stack },
    });

    await ackMessage(messageId);
    await handleJobFailure(jobId);

    const duration = finishedAt.getTime() - startedAt.getTime();
    executionDuration.observe({ handler: 'unknown', status: 'FAILURE' }, duration);

    // Look up job for webhook context
    const job = await Job.findById(jobId);
    if (job) {
      deliverWebhook(job.tenantId.toString(), {
        event: 'job.failed', jobId, tenantId: job.tenantId.toString(),
        name: job.name, status: job.status, timestamp: finishedAt.toISOString(),
        executionId, workerId: this.workerId, duration, error: err.message,
      }).catch(() => {});
    }

    log.warn({ jobId, err: err.message }, 'failed');
  }
}

function extractField(fields: string[], key: string): string | null {
  for (let i = 0; i < fields.length - 1; i += 2) {
    if (fields[i] === key) return fields[i + 1];
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}
