import { registerHandler } from './registry';

// Simulates real work — random duration, ~20% failure rate
registerHandler('demo:process', async (payload) => {
  const duration = 500 + Math.random() * 2500;
  await new Promise((r) => setTimeout(r, duration));

  if (Math.random() < 0.2) {
    throw new Error('simulated failure');
  }

  return { processed: true, duration: Math.round(duration) };
});

registerHandler('demo:echo', async (payload) => {
  return { echo: payload };
});

// Always fails — useful for testing DLQ
registerHandler('demo:always-fail', async () => {
  throw new Error('intentional failure');
});
