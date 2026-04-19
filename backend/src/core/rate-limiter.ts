import { getRedisClient } from '../lib/redis';

/**
 * Sliding window rate limiter using Redis sorted set.
 * Each request adds a timestamped entry. We count entries within the window.
 * Returns { allowed, remaining, resetMs }.
 */
export async function checkRateLimit(
  tenantId: string,
  maxPerMinute: number
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const redis = getRedisClient();
  const key = `rl:${tenantId}`;
  const now = Date.now();
  const windowMs = 60_000;
  const windowStart = now - windowMs;

  const pipeline = redis.pipeline();
  // Remove entries outside the window
  pipeline.zremrangebyscore(key, 0, windowStart);
  // Count entries in the window
  pipeline.zcard(key);
  // Add current request
  pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`);
  // Set TTL so the key auto-cleans
  pipeline.pexpire(key, windowMs);

  const results = await pipeline.exec();
  const count = (results?.[1]?.[1] as number) || 0;

  const allowed = count < maxPerMinute;
  const remaining = Math.max(0, maxPerMinute - count - (allowed ? 1 : 0));

  // Time until the oldest entry in the window expires
  const oldestResult = await redis.zrange(key, 0, 0, 'WITHSCORES');
  const resetMs = oldestResult.length >= 2
    ? Math.max(0, parseInt(oldestResult[1], 10) + windowMs - now)
    : windowMs;

  if (!allowed) {
    // Remove the entry we just added since request is denied
    const members = await redis.zrangebyscore(key, now, now);
    if (members.length > 0) {
      await redis.zrem(key, members[members.length - 1]);
    }
  }

  return { allowed, remaining, resetMs };
}
