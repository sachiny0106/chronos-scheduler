import { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../../core/rate-limiter';
import { rateLimitRejections } from '../../lib/metrics';

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.tenant) { next(); return; }

  const { allowed, remaining, resetMs } = await checkRateLimit(
    req.tenant._id.toString(),
    req.tenant.rateLimit.maxJobsPerMinute
  );

  res.setHeader('X-RateLimit-Limit', req.tenant.rateLimit.maxJobsPerMinute);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(resetMs / 1000));

  if (!allowed) {
    rateLimitRejections.inc({ tenant: req.tenant._id.toString() });
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(resetMs / 1000),
    });
    return;
  }

  next();
}
