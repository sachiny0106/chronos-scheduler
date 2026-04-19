import { Request, Response, NextFunction } from 'express';
import { Tenant, ITenant } from '../../models/tenant.model';

declare global {
  namespace Express {
    interface Request {
      tenant?: ITenant;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: 'Missing x-api-key header' });
    return;
  }

  const tenant = await Tenant.findOne({ apiKey });
  if (!tenant) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  req.tenant = tenant;
  next();
}
