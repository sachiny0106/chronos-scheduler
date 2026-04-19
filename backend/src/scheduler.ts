import { connectMongo, closeMongo } from './lib/mongo';
import { getRedisClient, closeRedis } from './lib/redis';
import { LeaderElection } from './core/leader-election';
import { SchedulerLoop } from './core/scheduler-loop';
import { Reaper } from './core/reaper';
import { createChildLogger } from './lib/logger';

const log = createChildLogger('scheduler');

async function main() {
  await connectMongo();
  await getRedisClient().connect();

  const leader = new LeaderElection();
  const loop = new SchedulerLoop(leader);
  const reaper = new Reaper(leader);

  await leader.start();

  leader.on('elected', () => log.info('now leader'));
  leader.on('demoted', () => log.warn('demoted to standby'));

  await loop.start();
  reaper.start();

  log.info('scheduler started');

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down');
    loop.stop();
    reaper.stop();
    await leader.stop();
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
