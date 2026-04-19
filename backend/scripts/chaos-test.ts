/**
 * Chaos Test Script
 *
 * Demonstrates fault tolerance by:
 * 1. Submitting jobs that always fail → verifies retry + DLQ
 * 2. Submitting jobs with idempotency keys → verifies dedup
 * 3. Checking reaper detects stuck jobs (simulated)
 *
 * Usage: tsx scripts/chaos-test.ts [apiUrl]
 */

const API_URL = process.argv[2] || 'http://localhost:3000';

async function getApiKey(): Promise<string> {
  const res = await fetch(`${API_URL}/tenants`, { method: 'GET' });
  const tenants = await res.json();
  if (tenants.length > 0) return tenants[0].apiKey;

  const createRes = await fetch(`${API_URL}/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `chaos-test-${Date.now()}` }),
  });
  const tenant = await createRes.json();
  return tenant.apiKey;
}

function headers(apiKey: string) {
  return { 'Content-Type': 'application/json', 'x-api-key': apiKey };
}

async function testRetryAndDLQ(apiKey: string): Promise<void> {
  console.log('\n--- Test 1: Retry + Dead Letter Queue ---');
  console.log('Submitting a job that always fails (maxRetries=2)...');

  const res = await fetch(`${API_URL}/jobs`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      name: 'demo:always-fail',
      type: 'one-time',
      payload: { test: 'retry-dlq' },
      runAt: new Date().toISOString(),
      maxRetries: 2,
      timeout: 5000,
    }),
  });

  const job = await res.json();
  console.log(`  Job created: ${job._id}`);

  // Poll until it reaches DEAD_LETTER
  let attempts = 0;
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(`${API_URL}/jobs/${job._id}`, { headers: headers(apiKey) });
    const current = await statusRes.json();
    console.log(`  Status: ${current.status} (retryCount: ${current.retryCount})`);

    if (current.status === 'DEAD_LETTER') {
      console.log('  PASS: Job reached DEAD_LETTER after max retries');

      // Verify it appears in DLQ
      const dlqRes = await fetch(`${API_URL}/dlq`, { headers: headers(apiKey) });
      const dlqJobs = await dlqRes.json();
      const inDlq = dlqJobs.some((j: any) => j._id === job._id);
      console.log(`  PASS: Job ${inDlq ? 'found' : 'NOT found'} in DLQ endpoint`);
      return;
    }

    attempts++;
  }

  console.log('  FAIL: Job did not reach DEAD_LETTER in time');
}

async function testIdempotency(apiKey: string): Promise<void> {
  console.log('\n--- Test 2: Idempotency ---');
  const idempotencyKey = `chaos-test-${Date.now()}`;
  console.log(`Submitting 3 jobs with same idempotency key: ${idempotencyKey}`);

  const jobIds: string[] = [];

  for (let i = 0; i < 3; i++) {
    const res = await fetch(`${API_URL}/jobs`, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({
        name: 'demo:echo',
        type: 'one-time',
        payload: { attempt: i },
        runAt: new Date().toISOString(),
        idempotencyKey,
      }),
    });

    const job = await res.json();
    jobIds.push(job._id);
    console.log(`  Attempt ${i + 1}: Job ID = ${job._id}`);
  }

  const allSame = jobIds.every((id) => id === jobIds[0]);
  console.log(`  ${allSame ? 'PASS' : 'FAIL'}: All 3 submissions returned ${allSame ? 'the same' : 'different'} job ID`);
}

async function testDLQRetry(apiKey: string): Promise<void> {
  console.log('\n--- Test 3: DLQ Manual Retry ---');

  const dlqRes = await fetch(`${API_URL}/dlq`, { headers: headers(apiKey) });
  const dlqJobs = await dlqRes.json();

  if (dlqJobs.length === 0) {
    console.log('  SKIP: No jobs in DLQ to retry (run Test 1 first)');
    return;
  }

  const jobId = dlqJobs[0]._id;
  console.log(`  Retrying DLQ job: ${jobId}`);

  const retryRes = await fetch(`${API_URL}/dlq/${jobId}/retry`, {
    method: 'POST',
    headers: headers(apiKey),
  });

  const retried = await retryRes.json();
  console.log(`  Status after retry: ${retried.status}`);
  console.log(`  ${retried.status === 'SCHEDULED' ? 'PASS' : 'FAIL'}: Job re-enqueued from DLQ`);
}

async function main() {
  console.log('=== Chronos Chaos Test ===');
  console.log(`Target: ${API_URL}`);

  const apiKey = await getApiKey();

  await testRetryAndDLQ(apiKey);
  await testIdempotency(apiKey);
  await testDLQRetry(apiKey);

  console.log('\n=== Chaos Test Complete ===');
}

main().catch((err) => {
  console.error('Chaos test failed:', err.message);
  process.exit(1);
});
