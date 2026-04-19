import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

// Job creation counter
export const jobsCreated = new Counter({
  name: 'chronos_jobs_created_total',
  help: 'Total jobs created',
  labelNames: ['tenant', 'type'] as const,
  registers: [registry],
});

// Job state transitions
export const jobTransitions = new Counter({
  name: 'chronos_job_transitions_total',
  help: 'Job state transitions',
  labelNames: ['from', 'to'] as const,
  registers: [registry],
});

// Execution duration
export const executionDuration = new Histogram({
  name: 'chronos_execution_duration_ms',
  help: 'Job execution duration in milliseconds',
  labelNames: ['handler', 'status'] as const,
  buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
  registers: [registry],
});

// Queue depth (jobs waiting to be processed)
export const queueDepth = new Gauge({
  name: 'chronos_queue_depth',
  help: 'Number of jobs in due_jobs sorted set',
  registers: [registry],
});

// Active workers
export const activeJobs = new Gauge({
  name: 'chronos_active_jobs',
  help: 'Jobs currently being processed by workers',
  registers: [registry],
});

// Rate limit rejections
export const rateLimitRejections = new Counter({
  name: 'chronos_rate_limit_rejections_total',
  help: 'Rate limit rejections',
  labelNames: ['tenant'] as const,
  registers: [registry],
});
