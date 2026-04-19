import dotenv from 'dotenv';
dotenv.config();

function env(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
}

export const config = {
  mongo: {
    uri: env('MONGO_URI', 'mongodb://localhost:27017/chronos'),
  },
  redis: {
    host: env('REDIS_HOST', 'localhost'),
    port: envInt('REDIS_PORT', 6380),
  },
  api: {
    port: envInt('API_PORT', 3000),
  },
  scheduler: {
    pollIntervalMs: envInt('SCHEDULER_POLL_INTERVAL_MS', 1000),
    leaderLeaseTtlMs: envInt('LEADER_LEASE_TTL_MS', 10000),
    batchSize: envInt('SCHEDULER_BATCH_SIZE', 100),
  },
  worker: {
    concurrency: envInt('WORKER_CONCURRENCY', 5),
    heartbeatIntervalMs: envInt('HEARTBEAT_INTERVAL_MS', 5000),
    reaperIntervalMs: envInt('REAPER_INTERVAL_MS', 10000),
    blockTimeoutMs: 5000,
    shutdownGracePeriodMs: 10000,
  },
  kafka: {
    brokers: env('KAFKA_BROKERS', 'localhost:9092').split(','),
  },
  log: {
    level: env('LOG_LEVEL', 'info'),
  },
};
