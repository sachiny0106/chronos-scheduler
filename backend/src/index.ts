import { config } from './config';
import { connectMongo, closeMongo } from './lib/mongo';
import { getRedisClient, closeRedis } from './lib/redis';
import { closeEventService } from './services/event.service';
import { createApp } from './api/server';
import { createChildLogger } from './lib/logger';

const log = createChildLogger('api');

async function main() {
  await connectMongo();
  await getRedisClient().connect();

  // Only init Kafka topics when running locally with Docker Kafka
  if (config.kafka.brokers[0] && config.kafka.brokers[0] !== '') {
    try {
      const { ensureTopics } = await import('./lib/kafka');
      await ensureTopics();
    } catch (err: any) {
      log.warn({ err: err.message }, 'kafka not available, using redis pub/sub');
    }
  }

  const { server } = createApp();

  server.listen(config.api.port, () => {
    log.info({ port: config.api.port }, 'API server started');
  });

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down');
    server.close();
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
