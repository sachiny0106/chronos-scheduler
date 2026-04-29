import mongoose from 'mongoose';
import { config } from '../src/config';

async function fix() {
  await mongoose.connect(config.mongo.uri);
  const db = mongoose.connection.db!;

  await db.collection('jobs').createIndex(
    { tenantId: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true, $type: 'string' } } }
  );

  const indexes = await db.collection('jobs').indexes();
  for (const idx of indexes) {
    console.log(idx.name, idx.partialFilterExpression ? 'PARTIAL' : '');
  }

  await mongoose.disconnect();
}

fix();
