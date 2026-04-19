import { connectMongo, closeMongo } from './lib/mongo';
import { getRedisClient, closeRedis } from './lib/redis';
import { closeEventService } from './services/event.service';
import { WorkerPool } from './core/worker-pool';
import { createChildLogger } from './lib/logger';

// Register handlers on import
import './handlers/sample-handler';

const log = createChildLogger('worker');

async function main() {
  await connectMongo();
  await getRedisClient().connect();

  const pool = new WorkerPool();
  await pool.start();

  log.info({ workerId: pool.workerId }, 'worker started');

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down');
    await pool.stop();
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
