import Redis from 'ioredis';
import { config } from '../config';
import { createChildLogger } from './logger';

const log = createChildLogger('redis');

/**
 * Create a new Redis client.
 * We need separate clients for:
 *  - General commands
 *  - Blocking reads (XREADGROUP) — blocks the connection
 *  - Pub/Sub subscriber — dedicated connection required
 */
export function createRedisClient(name: string): Redis {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null, // required for blocking commands
    lazyConnect: true,
  });

  client.on('connect', () => log.info({ name }, 'Redis connected'));
  client.on('error', (err) => log.error({ name, err: err.message }, 'Redis error'));

  return client;
}

// Shared client for general (non-blocking) commands
let _defaultClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!_defaultClient) {
    _defaultClient = createRedisClient('default');
  }
  return _defaultClient;
}

export async function closeRedis(): Promise<void> {
  if (_defaultClient) {
    await _defaultClient.quit();
    _defaultClient = null;
  }
}
