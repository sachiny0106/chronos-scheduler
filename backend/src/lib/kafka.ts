import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { config } from '../config';
import { createChildLogger } from './logger';

const log = createChildLogger('kafka');

let _kafka: Kafka | null = null;
let _producer: Producer | null = null;

export const TOPICS = {
  JOB_EVENTS: 'chronos.job.events',
} as const;

function getKafka(): Kafka {
  if (!_kafka) {
    _kafka = new Kafka({
      clientId: 'chronos',
      brokers: config.kafka.brokers,
      logLevel: logLevel.WARN,
      retry: { initialRetryTime: 300, retries: 5 },
    });
  }
  return _kafka;
}

export async function getProducer(): Promise<Producer> {
  if (!_producer) {
    _producer = getKafka().producer();
    await _producer.connect();
    log.info('producer connected');
  }
  return _producer;
}

export async function createConsumer(groupId: string): Promise<Consumer> {
  const consumer = getKafka().consumer({ groupId });
  await consumer.connect();
  log.info({ groupId }, 'consumer connected');
  return consumer;
}

export async function ensureTopics(): Promise<void> {
  const admin = getKafka().admin();
  await admin.connect();

  const existing = await admin.listTopics();
  const toCreate = Object.values(TOPICS).filter(t => !existing.includes(t));

  if (toCreate.length > 0) {
    await admin.createTopics({
      topics: toCreate.map(topic => ({ topic, numPartitions: 3, replicationFactor: 1 })),
    });
    log.info({ topics: toCreate }, 'topics created');
  }

  await admin.disconnect();
}

export async function closeKafka(): Promise<void> {
  if (_producer) { await _producer.disconnect(); _producer = null; }
}
