import { config } from '../config';
import { createRedisClient } from '../lib/redis';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('events');

const CHANNEL = 'job_events';
const useKafka = config.kafka.brokers[0] !== '' && config.kafka.brokers[0] !== 'localhost:9092' ? false : !!config.kafka.brokers[0];

export interface JobEvent {
  jobId: string;
  tenantId: string;
  from: string;
  to: string;
  timestamp: string;
  workerId?: string;
}

// Redis Pub/Sub — works with both local Redis and Upstash
let _pub: ReturnType<typeof createRedisClient> | null = null;

async function getPub() {
  if (!_pub) {
    _pub = createRedisClient('event-pub');
    await _pub.connect();
  }
  return _pub;
}

export async function publishJobEvent(event: JobEvent): Promise<void> {
  try {
    if (useKafka) {
      // Local dev with Docker Kafka
      const { getProducer } = await import('../lib/kafka');
      const producer = await getProducer();
      await producer.send({
        topic: 'chronos.job.events',
        messages: [{ key: event.tenantId, value: JSON.stringify(event) }],
      });
    } else {
      // Cloud (Upstash) or local without Kafka — Redis Pub/Sub
      const pub = await getPub();
      await pub.publish(CHANNEL, JSON.stringify(event));
    }
  } catch (err: any) {
    log.error({ err: err.message }, 'publish failed');
  }
}

export async function consumeJobEvents(
  groupId: string,
  cb: (event: JobEvent) => void
): Promise<() => Promise<void>> {
  if (useKafka) {
    const { createConsumer } = await import('../lib/kafka');
    const consumer = await createConsumer(groupId);
    await consumer.subscribe({ topic: 'chronos.job.events', fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try { cb(JSON.parse(message.value.toString())); }
        catch (err: any) { log.error({ err: err.message }, 'parse error'); }
      },
    });
    log.info({ groupId }, 'consuming via kafka');
    return async () => { await consumer.disconnect(); };
  }

  // Redis Pub/Sub
  const sub = createRedisClient('event-sub');
  await sub.connect();
  sub.on('message', (_ch: string, msg: string) => {
    try { cb(JSON.parse(msg)); }
    catch (err: any) { log.error({ err: err.message }, 'parse error'); }
  });
  await sub.subscribe(CHANNEL);
  log.info('consuming via redis pub/sub');
  return async () => { await sub.unsubscribe(CHANNEL); await sub.quit(); };
}

export async function closeEventService(): Promise<void> {
  if (_pub) { await _pub.quit(); _pub = null; }
}
