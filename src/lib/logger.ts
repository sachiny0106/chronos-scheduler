import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.log.level,
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
});

export const createChildLogger = (component: string) =>
  logger.child({ component });
