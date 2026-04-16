import mongoose from 'mongoose';
import { config } from '../config';
import { createChildLogger } from './logger';

const log = createChildLogger('mongo');

export async function connectMongo(): Promise<void> {
  mongoose.connection.on('connected', () => log.info('MongoDB connected'));
  mongoose.connection.on('error', (err) => log.error({ err: err.message }, 'MongoDB error'));

  await mongoose.connect(config.mongo.uri);
}

export async function closeMongo(): Promise<void> {
  await mongoose.disconnect();
}
