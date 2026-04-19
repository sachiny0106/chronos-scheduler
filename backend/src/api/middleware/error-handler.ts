import { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '../../lib/logger';

const log = createChildLogger('error');

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  log.error({ err: err.message, stack: err.stack }, 'unhandled');
  res.status(500).json({ error: 'Internal server error' });
}
