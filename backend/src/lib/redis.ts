import Redis from 'ioredis';
import { config } from '../config';
import { createChildLogger } from './logger';

const log = createChildLogger('redis');

// Separate clients needed for: general ops, blocking XREADGROUP, pub/sub
export function createRedisClient(name: string): Redis {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null, // required for blocking commands
    lazyConnect: true,
  });

  client.on('connect', () => log.info({ name }, 'connected'));
  client.on('error', (err) => log.error({ name, err: err.message }, 'error'));

  return client;
}

let _client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!_client) {
    _client = createRedisClient('default');
  }
  return _client;
}

export async function closeRedis(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
  }
}
