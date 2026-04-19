import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketServer } from 'socket.io';
import { errorHandler } from './middleware/error-handler';
import jobRoutes from './routes/job.routes';
import tenantRoutes from './routes/tenant.routes';
import dlqRoutes from './routes/dlq.routes';
import metricsRoutes from './routes/metrics.routes';
import { consumeJobEvents, JobEvent } from '../services/event.service';
import { registry } from '../lib/metrics';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('api');

export function createApp() {
  const app = express();
  const server = http.createServer(app);

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // Prometheus metrics endpoint
  app.get('/prom', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  app.use('/jobs', jobRoutes);
  app.use('/tenants', tenantRoutes);
  app.use('/dlq', dlqRoutes);
  app.use('/metrics', metricsRoutes);

  app.use(errorHandler);

  const io = new SocketServer(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    log.info({ socketId: socket.id }, 'dashboard connected');
    socket.on('disconnect', () => log.debug({ socketId: socket.id }, 'disconnected'));
  });

  // Kafka consumer → Socket.io bridge
  consumeJobEvents('chronos-dashboard', (event: JobEvent) => {
    io.emit('job:update', event);
  }).catch(err => {
    log.error({ err: err.message }, 'failed to consume kafka events');
  });

  return { app, server, io };
}
