/**
 * Load Test Script
 *
 * Submits N jobs to the API and tracks:
 * - Submission throughput
 * - Completion time (polls until all done)
 * - Distribution across workers
 *
 * Usage: tsx scripts/load-test.ts [jobCount] [apiUrl]
 */

const JOB_COUNT = parseInt(process.argv[2] || '100', 10);
const API_URL = process.argv[3] || 'http://localhost:3000';

interface JobResponse {
  _id: string;
  status: string;
  workerId?: string;
}

async function getApiKey(): Promise<string> {
  // Create or get the demo tenant
  const res = await fetch(`${API_URL}/tenants`, { method: 'GET' });
  const tenants = await res.json();

  if (tenants.length > 0) return tenants[0].apiKey;

  // Create one
  const createRes = await fetch(`${API_URL}/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `load-test-${Date.now()}` }),
  });
  const tenant = await createRes.json();
  return tenant.apiKey;
}

async function submitJobs(apiKey: string): Promise<string[]> {
  console.log(`\nSubmitting ${JOB_COUNT} jobs...`);
  const startTime = Date.now();
  const jobIds: string[] = [];

  const promises = Array.from({ length: JOB_COUNT }, (_, i) =>
    fetch(`${API_URL}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        name: 'demo:process',
        type: 'one-time',
        payload: { index: i, message: `Load test job #${i}` },
        runAt: new Date().toISOString(),
        priority: Math.ceil(Math.random() * 10),
        maxRetries: 2,
      }),
    })
      .then((res) => res.json())
      .then((job: JobResponse) => {
        jobIds.push(job._id);
      })
  );

  await Promise.all(promises);

  const elapsed = Date.now() - startTime;
  console.log(`Submitted ${jobIds.length} jobs in ${elapsed}ms (${Math.round(jobIds.length / (elapsed / 1000))} jobs/sec)`);
  return jobIds;
}

async function waitForCompletion(apiKey: string, jobIds: string[]): Promise<void> {
  console.log('\nWaiting for all jobs to complete...');
  const startTime = Date.now();
  const workerCounts: Record<string, number> = {};
  let completed = 0;
  let failed = 0;
  let deadLetter = 0;

  while (completed + failed + deadLetter < jobIds.length) {
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(`${API_URL}/jobs?limit=${JOB_COUNT}`, {
      headers: { 'x-api-key': apiKey },
    });
    const { jobs } = await res.json();

    completed = 0;
    failed = 0;
    deadLetter = 0;

    for (const job of jobs as JobResponse[]) {
      if (job.status === 'COMPLETED') {
        completed++;
        if (job.workerId) {
          workerCounts[job.workerId] = (workerCounts[job.workerId] || 0) + 1;
        }
      } else if (job.status === 'FAILED' || job.status === 'RETRYING') {
        failed++;
      } else if (job.status === 'DEAD_LETTER') {
        deadLetter++;
      }
    }

    const total = completed + failed + deadLetter;
    const pending = jobIds.length - total;
    process.stdout.write(`\r  Completed: ${completed} | Failed/Retrying: ${failed} | DLQ: ${deadLetter} | Pending: ${pending}`);
  }

  const elapsed = Date.now() - startTime;
  console.log(`\n\nAll jobs finished in ${elapsed}ms`);
  console.log(`  Completed:    ${completed}`);
  console.log(`  Dead Letter:  ${deadLetter}`);
  console.log(`  Throughput:   ${Math.round(jobIds.length / (elapsed / 1000))} jobs/sec`);

  console.log('\nWorker distribution:');
  for (const [workerId, count] of Object.entries(workerCounts).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / completed) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / completed * 30));
    console.log(`  ${workerId}: ${count} jobs (${pct}%) ${bar}`);
  }
}

async function main() {
  console.log('=== Chronos Load Test ===');
  console.log(`Target: ${API_URL}`);
  console.log(`Jobs:   ${JOB_COUNT}`);

  const apiKey = await getApiKey();
  const jobIds = await submitJobs(apiKey);
  await waitForCompletion(apiKey, jobIds);

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Load test failed:', err.message);
  process.exit(1);
});
