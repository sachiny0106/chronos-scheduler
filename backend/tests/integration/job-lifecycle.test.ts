import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { config } from '../../src/config';
import { Job, JobStatus, JobType } from '../../src/models/job.model';
import { Tenant } from '../../src/models/tenant.model';
import { ExecutionLog } from '../../src/models/execution-log.model';
import { transitionJob } from '../../src/core/state-machine';
import { getNextDelay } from '../../src/core/retry-strategy';
import { RetryBackoff } from '../../src/models/job.model';

let redis: Redis;

beforeAll(async () => {
  await mongoose.connect(config.mongo.uri);
  redis = new Redis({ host: config.redis.host, port: config.redis.port });
  // Clean test data
  await Job.deleteMany({});
  await Tenant.deleteMany({});
  await ExecutionLog.deleteMany({});
}, 15000);

afterAll(async () => {
  await redis.quit();
  await mongoose.disconnect();
}, 10000);

describe('job lifecycle', () => {
  let tenantId: string;

  it('creates a tenant', async () => {
    const tenant = await Tenant.create({ name: 'test-tenant' });
    tenantId = tenant._id.toString();
    expect(tenant.apiKey).toMatch(/^ck_/);
  });

  it('creates a job in PENDING state', async () => {
    const job = await Job.create({
      tenantId,
      name: 'test:echo',
      type: JobType.ONE_TIME,
      payload: { msg: 'hello' },
      status: JobStatus.PENDING,
      runAt: new Date(),
    });

    expect(job.status).toBe(JobStatus.PENDING);
    expect(job.retryCount).toBe(0);
  });

  it('transitions PENDING → SCHEDULED → QUEUED → RUNNING → COMPLETED', async () => {
    const job = await Job.create({
      tenantId,
      name: 'test:full-lifecycle',
      type: JobType.ONE_TIME,
      payload: {},
      status: JobStatus.PENDING,
      runAt: new Date(),
    });

    const id = job._id.toString();

    const scheduled = await transitionJob(id, JobStatus.PENDING, JobStatus.SCHEDULED);
    expect(scheduled?.status).toBe(JobStatus.SCHEDULED);

    const queued = await transitionJob(id, JobStatus.SCHEDULED, JobStatus.QUEUED);
    expect(queued?.status).toBe(JobStatus.QUEUED);

    const running = await transitionJob(id, JobStatus.QUEUED, JobStatus.RUNNING, {
      workerId: 'test-worker',
      executionId: 'exec-1',
    });
    expect(running?.status).toBe(JobStatus.RUNNING);
    expect(running?.workerId).toBe('test-worker');

    const completed = await transitionJob(id, JobStatus.RUNNING, JobStatus.COMPLETED);
    expect(completed?.status).toBe(JobStatus.COMPLETED);
  });

  it('rejects invalid transitions', async () => {
    const job = await Job.create({
      tenantId,
      name: 'test:invalid',
      type: JobType.ONE_TIME,
      payload: {},
      status: JobStatus.PENDING,
      runAt: new Date(),
    });

    const id = job._id.toString();

    // PENDING → RUNNING is invalid (must go through SCHEDULED → QUEUED first)
    const result = await transitionJob(id, JobStatus.PENDING, JobStatus.RUNNING);
    expect(result).toBeNull();

    // Job should still be PENDING
    const check = await Job.findById(id);
    expect(check?.status).toBe(JobStatus.PENDING);
  });

  it('prevents double-claim (concurrent workers)', async () => {
    const job = await Job.create({
      tenantId,
      name: 'test:race',
      type: JobType.ONE_TIME,
      payload: {},
      status: JobStatus.QUEUED,
      runAt: new Date(),
    });

    const id = job._id.toString();

    // Two workers try to claim simultaneously
    const [w1, w2] = await Promise.all([
      transitionJob(id, JobStatus.QUEUED, JobStatus.RUNNING, { workerId: 'worker-1' }),
      transitionJob(id, JobStatus.QUEUED, JobStatus.RUNNING, { workerId: 'worker-2' }),
    ]);

    // Exactly one should succeed
    const winners = [w1, w2].filter(Boolean);
    expect(winners).toHaveLength(1);
    expect(winners[0]?.workerId).toMatch(/^worker-/);
  });

  it('follows retry path: FAILED → RETRYING → SCHEDULED', async () => {
    const job = await Job.create({
      tenantId,
      name: 'test:retry',
      type: JobType.ONE_TIME,
      payload: {},
      status: JobStatus.FAILED,
      runAt: new Date(),
      maxRetries: 3,
      retryCount: 0,
    });

    const id = job._id.toString();

    const retrying = await transitionJob(id, JobStatus.FAILED, JobStatus.RETRYING, {
      retryCount: 1,
    });
    expect(retrying?.status).toBe(JobStatus.RETRYING);
    expect(retrying?.retryCount).toBe(1);

    const scheduled = await transitionJob(id, JobStatus.RETRYING, JobStatus.SCHEDULED);
    expect(scheduled?.status).toBe(JobStatus.SCHEDULED);
  });

  it('sends to DLQ after max retries', async () => {
    const job = await Job.create({
      tenantId,
      name: 'test:dlq',
      type: JobType.ONE_TIME,
      payload: {},
      status: JobStatus.FAILED,
      runAt: new Date(),
      maxRetries: 2,
      retryCount: 2,
    });

    const id = job._id.toString();

    const dlq = await transitionJob(id, JobStatus.FAILED, JobStatus.DEAD_LETTER);
    expect(dlq?.status).toBe(JobStatus.DEAD_LETTER);
  });

  it('allows DLQ manual retry: DEAD_LETTER → PENDING', async () => {
    const job = await Job.create({
      tenantId,
      name: 'test:dlq-retry',
      type: JobType.ONE_TIME,
      payload: {},
      status: JobStatus.DEAD_LETTER,
      runAt: new Date(),
      retryCount: 3,
    });

    const id = job._id.toString();

    const pending = await transitionJob(id, JobStatus.DEAD_LETTER, JobStatus.PENDING, {
      retryCount: 0,
    });
    expect(pending?.status).toBe(JobStatus.PENDING);
    expect(pending?.retryCount).toBe(0);
  });
});
