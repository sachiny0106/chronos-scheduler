import { getRedisClient } from '../lib/redis';

const TTL = 3600;

function rk(tenantId: string, key: string) {
  return `idem:${tenantId}:${key}`;
}

export async function claimIdempotencyKey(tenantId: string, key: string, jobId: string): Promise<string | null> {
  const redis = getRedisClient();
  const acquired = await redis.set(rk(tenantId, key), jobId, 'EX', TTL, 'NX');
  if (acquired === 'OK') return null;
  return redis.get(rk(tenantId, key));
}

export async function releaseIdempotencyKey(tenantId: string, key: string): Promise<void> {
  await getRedisClient().del(rk(tenantId, key));
}
