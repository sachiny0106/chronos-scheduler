import Redis from 'ioredis';
import { config } from '../config';
import { createChildLogger } from './logger';

const log = createChildLogger('redis');

export function createRedisClient(name: string): Redis {
  const opts: any = {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };

  let client: Redis;

  if (config.redis.url) {
    // Cloud Redis (Upstash) — uses rediss:// URL with TLS
    client = new Redis(config.redis.url, opts);
  } else {
    // Local Redis — host/port
    client = new Redis({ host: config.redis.host, port: config.redis.port, ...opts });
  }

  client.on('connect', () => log.info({ name }, 'connected'));
  client.on('error', (err) => log.error({ name, err: err.message }, 'error'));

  return client;
}

let _client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!_client) _client = createRedisClient('default');
  return _client;
}

export async function closeRedis(): Promise<void> {
  if (_client) { await _client.quit(); _client = null; }
}
