import { getProducer, createConsumer, TOPICS, closeKafka } from '../lib/kafka';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('events');

export interface JobEvent {
  jobId: string;
  tenantId: string;
  from: string;
  to: string;
  timestamp: string;
  workerId?: string;
}

/**
 * Publish a job state change event to Kafka.
 * Partitioned by tenantId so events for the same tenant are ordered.
 */
export async function publishJobEvent(event: JobEvent): Promise<void> {
  try {
    const producer = await getProducer();
    await producer.send({
      topic: TOPICS.JOB_EVENTS,
      messages: [{
        key: event.tenantId,
        value: JSON.stringify(event),
      }],
    });
  } catch (err: any) {
    log.error({ err: err.message }, 'kafka publish failed');
  }
}

/**
 * Consume job events from Kafka. Each consumer group gets independent delivery.
 * Returns a disconnect function.
 */
export async function consumeJobEvents(
  groupId: string,
  cb: (event: JobEvent) => void
): Promise<() => Promise<void>> {
  const consumer = await createConsumer(groupId);

  await consumer.subscribe({ topic: TOPICS.JOB_EVENTS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const event = JSON.parse(message.value.toString()) as JobEvent;
        cb(event);
      } catch (err: any) {
        log.error({ err: err.message }, 'event parse error');
      }
    },
  });

  log.info({ groupId }, 'consuming job events');

  return async () => {
    await consumer.disconnect();
  };
}

export async function closeEventService(): Promise<void> {
  await closeKafka();
}
