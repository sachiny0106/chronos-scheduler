import { config } from './config';
import { connectMongo, closeMongo } from './lib/mongo';
import { getRedisClient, closeRedis } from './lib/redis';
import { closeEventService } from './services/event.service';
import { createApp } from './api/server';
import { LeaderElection } from './core/leader-election';
import { SchedulerLoop } from './core/scheduler-loop';
import { Reaper } from './core/reaper';
import { WorkerPool } from './core/worker-pool';
import { createChildLogger } from './lib/logger';

import './handlers/sample-handler';

const log = createChildLogger('combined');

async function main() {
  await connectMongo();
  await getRedisClient().connect();

  if (config.kafka.brokers.length > 0) {
    try {
      const { ensureTopics } = await import('./lib/kafka');
      await ensureTopics();
    } catch (err: any) {
      log.warn({ err: err.message }, 'kafka not available, using redis pub/sub');
    }
  }

  const { server } = createApp();
  server.listen(config.api.port, () => {
    log.info({ port: config.api.port }, 'API started');
  });

  const leader = new LeaderElection();
  const loop = new SchedulerLoop(leader);
  const reaper = new Reaper(leader);
  await leader.start();
  leader.on('elected', () => log.info('leader elected'));
  leader.on('demoted', () => log.warn('leader demoted'));
  await loop.start();
  reaper.start();

  const worker = new WorkerPool();
  await worker.start();

  log.info({ workerId: worker.workerId }, 'all services started');

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down');
    server.close();
    await worker.stop();
    loop.stop();
    reaper.stop();
    await leader.stop();
    await closeEventService();
    await closeRedis();
    await closeMongo();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  log.fatal({ err: err.message }, 'startup failed');
  process.exit(1);
});
