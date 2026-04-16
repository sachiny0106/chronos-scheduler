import dotenv from 'dotenv';
dotenv.config();

export const config = {
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/chronos',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  api: {
    port: parseInt(process.env.API_PORT || '3000', 10),
  },
  scheduler: {
    pollIntervalMs: parseInt(process.env.SCHEDULER_POLL_INTERVAL_MS || '1000', 10),
    leaderLeaseTtlMs: parseInt(process.env.LEADER_LEASE_TTL_MS || '10000', 10),
    leaderRenewIntervalMs: parseInt(process.env.LEADER_RENEW_INTERVAL_MS || '3000', 10),
    batchSize: parseInt(process.env.SCHEDULER_BATCH_SIZE || '100', 10),
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS || '5000', 10),
    reaperIntervalMs: parseInt(process.env.REAPER_INTERVAL_MS || '10000', 10),
    blockTimeoutMs: 5000,
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;
