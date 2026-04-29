/**
 * Full end-to-end test — exercises every feature with real data.
 * Run: npx tsx scripts/full-test.ts
 */

const API = 'http://localhost:3000';
let API_KEY = '';
let TENANT_ID = '';

function h() {
  return { 'Content-Type': 'application/json', 'x-api-key': API_KEY };
}

async function req(method: string, path: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: h(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data, headers: res.headers };
}

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForStatus(jobId: string, target: string, maxWait = 15000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const { data } = await req('GET', `/jobs/${jobId}`);
    if (data.status === target) return data;
    await sleep(1000);
  }
  const { data } = await req('GET', `/jobs/${jobId}`);
  return data;
}

// ─────────────────────────────────────────────
// Test 1: Health Check
// ─────────────────────────────────────────────
async function testHealth() {
  console.log('\n── Health Check ──');
  const res = await fetch(`${API}/health`);
  const data = await res.json();
  assert('GET /health returns 200', res.status === 200);
  assert('Response has status=ok', data.status === 'ok');
  assert('Response has timestamp', !!data.ts);
}

// ─────────────────────────────────────────────
// Test 2: Tenant CRUD
// ─────────────────────────────────────────────
async function testTenants() {
  console.log('\n── Tenant Management ──');

  // Create tenant with high rate limit for testing
  const res = await fetch(`${API}/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `test-tenant-${Date.now()}`, rateLimit: { maxJobsPerMinute: 1000 } }),
  });
  const tenant = await res.json();
  assert('Create tenant returns 201', res.status === 201);
  assert('Tenant has apiKey starting with ck_', tenant.apiKey?.startsWith('ck_'));
  assert('Tenant has rateLimit', tenant.rateLimit?.maxJobsPerMinute === 1000);

  API_KEY = tenant.apiKey;
  TENANT_ID = tenant._id;

  // List tenants
  const listRes = await fetch(`${API}/tenants`);
  const tenants = await listRes.json();
  assert('List tenants returns array', Array.isArray(tenants));
  assert('Our tenant is in the list', tenants.some((t: any) => t._id === TENANT_ID));

  // Duplicate name
  const dupRes = await fetch(`${API}/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: tenant.name }),
  });
  assert('Duplicate tenant returns 409', dupRes.status === 409);
}

// ─────────────────────────────────────────────
// Test 3: Job Creation + Completion (echo handler)
// ─────────────────────────────────────────────
async function testJobCompletion() {
  console.log('\n── Job Creation + Completion ──');

  const { status, data: job } = await req('POST', '/jobs', {
    name: 'demo:echo',
    type: 'one-time',
    payload: { message: 'Hello from full test!', number: 42 },
    runAt: new Date().toISOString(),
    priority: 8,
    maxRetries: 3,
  });

  assert('Create job returns 201', status === 201);
  assert('Job status is SCHEDULED', job.status === 'SCHEDULED');
  assert('Job has correct name', job.name === 'demo:echo');
  assert('Job has correct priority', job.priority === 8);
  assert('Payload preserved', job.payload?.message === 'Hello from full test!');

  // Wait for completion
  const completed = await waitForStatus(job._id, 'COMPLETED');
  assert('Job reached COMPLETED', completed.status === 'COMPLETED');
  assert('Job has workerId', !!completed.workerId);

  // Check execution log (small delay for async write)
  await sleep(500);
  const { data: execs } = await req('GET', `/jobs/${job._id}/executions`);
  assert('Execution log exists', Array.isArray(execs) && execs.length >= 1);
  if (execs.length > 0) {
    assert('Execution status is SUCCESS', execs[0].status === 'SUCCESS');
    assert('Execution has duration', execs[0].duration > 0);
    assert('Execution has workerId', !!execs[0].workerId);
  }
}

// ─────────────────────────────────────────────
// Test 4: Delayed Job
// ─────────────────────────────────────────────
async function testDelayedJob() {
  console.log('\n── Delayed Job ──');

  const futureDate = new Date(Date.now() + 3000); // 3s from now
  const { data: job } = await req('POST', '/jobs', {
    name: 'demo:echo',
    type: 'delayed',
    payload: { delayed: true },
    runAt: futureDate.toISOString(),
    priority: 5,
  });

  assert('Delayed job created', job.status === 'SCHEDULED', `got ${job.status}, error: ${job.error || JSON.stringify(job.details || '')}`);

  // Should not be completed immediately
  await sleep(1000);
  const { data: check1 } = await req('GET', `/jobs/${job._id}`);
  assert('Job not completed yet after 1s', check1.status !== 'COMPLETED');

  // Wait for it to run
  const completed = await waitForStatus(job._id, 'COMPLETED', 10000);
  assert('Delayed job eventually completes', completed.status === 'COMPLETED');
}

// ─────────────────────────────────────────────
// Test 5: Retry + Dead Letter Queue
// ─────────────────────────────────────────────
async function testRetryAndDLQ() {
  console.log('\n── Retry + DLQ ──');

  const dlqRes = await req('POST', '/jobs', {
    name: 'demo:always-fail',
    type: 'one-time',
    payload: { test: 'dlq-flow' },
    runAt: new Date().toISOString(),
    maxRetries: 2,
    timeout: 5000,
  });
  const job = dlqRes.data;

  assert('Failing job created', !!job._id, `status=${dlqRes.status}, error=${job.error}`);

  // Wait for DLQ (retries: 0→fail, 1→fail, 2→fail → DLQ)
  // With exponential backoff: ~5s + ~10s + processing = ~20s max
  console.log('  ... waiting for retries + DLQ (up to 30s)');
  const dlq = await waitForStatus(job._id, 'DEAD_LETTER', 30000);
  assert('Job reached DEAD_LETTER', dlq.status === 'DEAD_LETTER');
  assert('Retry count equals maxRetries', dlq.retryCount === 2);

  // Check execution logs show multiple attempts
  const { data: execs } = await req('GET', `/jobs/${job._id}/executions`);
  assert('Multiple execution attempts logged', execs.length >= 2);
  assert('All executions are FAILURE', execs.every((e: any) => e.status === 'FAILURE'));

  // Check DLQ list endpoint
  const { data: dlqList } = await req('GET', '/dlq');
  assert('Job appears in DLQ list', dlqList.some((j: any) => j._id === job._id));

  // Retry from DLQ
  const { status: retryStatus, data: retried } = await req('POST', `/dlq/${job._id}/retry`);
  assert('DLQ retry returns 200', retryStatus === 200);
  assert('Retried job is SCHEDULED', retried.status === 'SCHEDULED');
  assert('Retry count reset to 0', retried.retryCount === 0);
}

// ─────────────────────────────────────────────
// Test 6: Idempotency
// ─────────────────────────────────────────────
async function testIdempotency() {
  console.log('\n── Idempotency ──');

  const idemKey = `test-idem-${Date.now()}`;

  const { data: job1 } = await req('POST', '/jobs', {
    name: 'demo:echo',
    type: 'one-time',
    payload: { attempt: 1 },
    runAt: new Date().toISOString(),
    idempotencyKey: idemKey,
  });

  const { data: job2 } = await req('POST', '/jobs', {
    name: 'demo:echo',
    type: 'one-time',
    payload: { attempt: 2 },
    runAt: new Date().toISOString(),
    idempotencyKey: idemKey,
  });

  const { data: job3 } = await req('POST', '/jobs', {
    name: 'demo:echo',
    type: 'one-time',
    payload: { attempt: 3 },
    runAt: new Date().toISOString(),
    idempotencyKey: idemKey,
  });

  assert('All 3 return same job ID', job1._id === job2._id && job2._id === job3._id);
  assert('Only 1 job created (deduped)', job1._id === job3._id);
}

// ─────────────────────────────────────────────
// Test 7: Job Deletion
// ─────────────────────────────────────────────
async function testDeletion() {
  console.log('\n── Job Deletion ──');

  // Create a delayed job (far future so it stays SCHEDULED)
  const { data: job } = await req('POST', '/jobs', {
    name: 'demo:echo',
    type: 'delayed',
    payload: { deletable: true },
    runAt: new Date(Date.now() + 600000).toISOString(), // 10min from now
  });

  assert('Job created in SCHEDULED', job.status === 'SCHEDULED', `got status=${job.status}, error=${job.error}`);

  // Delete it
  const { status: delStatus } = await req('DELETE', `/jobs/${job._id}`);
  assert('Delete returns 204', delStatus === 204);

  // Verify it's gone
  const { status: getStatus } = await req('GET', `/jobs/${job._id}`);
  assert('Deleted job returns 404', getStatus === 404);

  // Try to delete a completed job (should fail)
  const { data: completedJob } = await req('POST', '/jobs', {
    name: 'demo:echo',
    type: 'one-time',
    payload: {},
    runAt: new Date().toISOString(),
  });
  await waitForStatus(completedJob._id, 'COMPLETED');
  const { status: delCompleted } = await req('DELETE', `/jobs/${completedJob._id}`);
  assert('Cannot delete completed job (404)', delCompleted === 404);
}

// ─────────────────────────────────────────────
// Test 8: Job Listing + Filtering + Pagination
// ─────────────────────────────────────────────
async function testListingAndFiltering() {
  console.log('\n── Listing + Filtering ──');

  const { data: all } = await req('GET', '/jobs?limit=100');
  assert('List returns jobs array', Array.isArray(all.jobs));
  assert('List returns total count', typeof all.total === 'number');
  assert('Total > 0 (we created jobs)', all.total > 0);

  // Filter by status
  const { data: completed } = await req('GET', '/jobs?status=COMPLETED&limit=100');
  assert('Filter by COMPLETED works', completed.jobs.every((j: any) => j.status === 'COMPLETED'));

  // Pagination
  const { data: page1 } = await req('GET', '/jobs?limit=2&offset=0');
  const { data: page2 } = await req('GET', '/jobs?limit=2&offset=2');
  assert('Pagination: page1 has max 2 jobs', page1.jobs.length <= 2);
  if (all.total > 2) {
    assert('Pagination: page2 has different jobs', page1.jobs[0]?._id !== page2.jobs[0]?._id);
  }
}

// ─────────────────────────────────────────────
// Test 9: Rate Limiting
// ─────────────────────────────────────────────
async function testRateLimiting() {
  console.log('\n── Rate Limiting ──');

  // Use a separate tenant with very low rate limit (don't pollute main API_KEY)
  const tenantRes = await fetch(`${API}/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `rate-limited-${Date.now()}`,
      rateLimit: { maxJobsPerMinute: 3 },
    }),
  });
  const rlTenant = await tenantRes.json();
  const rlHeaders = { 'Content-Type': 'application/json', 'x-api-key': rlTenant.apiKey };

  const results: number[] = [];
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${API}/jobs`, {
      method: 'POST',
      headers: rlHeaders,
      body: JSON.stringify({
        name: 'demo:echo',
        type: 'one-time',
        payload: { i },
        runAt: new Date().toISOString(),
      }),
    });
    results.push(res.status);
  }

  const created = results.filter(s => s === 201).length;
  const limited = results.filter(s => s === 429).length;

  assert('Some requests succeeded (201)', created > 0);
  assert('Some requests rate limited (429)', limited > 0);
  assert(`Created ${created}, rejected ${limited} (limit=3)`, created <= 3);
}

// ─────────────────────────────────────────────
// Test 10: Auth Failures
// ─────────────────────────────────────────────
async function testAuthFailures() {
  console.log('\n── Auth Failures ──');

  // No API key
  const noKey = await fetch(`${API}/jobs`);
  assert('No API key returns 401', noKey.status === 401);

  // Invalid API key
  const badKey = await fetch(`${API}/jobs`, {
    headers: { 'x-api-key': 'invalid_key_12345' },
  });
  assert('Invalid API key returns 401', badKey.status === 401);
}

// ─────────────────────────────────────────────
// Test 11: Validation Errors
// ─────────────────────────────────────────────
async function testValidation() {
  console.log('\n── Validation ──');

  // Missing required fields
  const { status: s1 } = await req('POST', '/jobs', {});
  assert('Empty body returns 400', s1 === 400);

  // Invalid type
  const { status: s2 } = await req('POST', '/jobs', {
    name: 'demo:echo',
    type: 'invalid-type',
    runAt: new Date().toISOString(),
  });
  assert('Invalid type returns 400', s2 === 400);

  // Cron without expression
  const { status: s3 } = await req('POST', '/jobs', {
    name: 'demo:echo',
    type: 'cron',
    runAt: new Date().toISOString(),
  });
  assert('Cron without expression returns 400', s3 === 400);

  // Invalid priority
  const { status: s4 } = await req('POST', '/jobs', {
    name: 'demo:echo',
    type: 'one-time',
    runAt: new Date().toISOString(),
    priority: 99,
  });
  assert('Priority > 10 returns 400', s4 === 400);
}

// ─────────────────────────────────────────────
// Test 12: Metrics + Prometheus
// ─────────────────────────────────────────────
async function testMetrics() {
  console.log('\n── Metrics ──');

  const { data: metrics } = await req('GET', '/metrics');
  assert('Metrics returns job counts', typeof metrics.jobs?.total === 'number');
  assert('Metrics returns executions', !!metrics.executions);
  assert('Metrics returns throughput', Array.isArray(metrics.throughput));

  // Prometheus endpoint
  const promRes = await fetch(`${API}/prom`);
  const promText = await promRes.text();
  assert('Prometheus endpoint returns text', promRes.status === 200);
  assert('Has job_transitions metric', promText.includes('chronos_job_transitions_total'));
  assert('Has execution_duration metric', promText.includes('chronos_execution_duration_ms'));
  assert('Has active_jobs metric', promText.includes('chronos_active_jobs'));
  assert('Has rate_limit metric', promText.includes('chronos_rate_limit_rejections_total'));
}

// ─────────────────────────────────────────────
// Test 13: Invalid ObjectId handling
// ─────────────────────────────────────────────
async function testInvalidIds() {
  console.log('\n── Invalid ID handling ──');

  const { status: s1 } = await req('GET', '/jobs/not-a-valid-id');
  assert('Invalid job ID returns 404', s1 === 404);

  const { status: s2 } = await req('DELETE', '/jobs/not-a-valid-id');
  assert('Delete invalid ID returns 404', s2 === 404);

  const { status: s3 } = await req('POST', '/dlq/not-a-valid-id/retry');
  assert('DLQ retry invalid ID returns 404', s3 === 404);
}

// ─────────────────────────────────────────────
// Test 14: Bulk Job Stress Test
// ─────────────────────────────────────────────
async function testBulkJobs() {
  console.log('\n── Bulk Jobs (20 concurrent) ──');

  const start = Date.now();
  const promises = Array.from({ length: 20 }, (_, i) =>
    req('POST', '/jobs', {
      name: 'demo:echo',
      type: 'one-time',
      payload: { index: i },
      runAt: new Date().toISOString(),
      priority: Math.ceil(Math.random() * 10),
    })
  );

  const results = await Promise.all(promises);
  const created = results.filter(r => r.status === 201).length;
  const elapsed = Date.now() - start;

  const firstFail = results.find(r => r.status !== 201);
  assert(`Created ${created}/20 jobs`, created === 20, firstFail ? `first failure: ${firstFail.status} ${JSON.stringify(firstFail.data)}` : '');
  assert(`Submission took ${elapsed}ms`, elapsed < 10000);

  // Wait for all to complete
  console.log('  ... waiting for all 20 to complete');
  await sleep(8000);

  const jobIds = results.map(r => r.data._id);
  let completedCount = 0;
  for (const id of jobIds) {
    const { data } = await req('GET', `/jobs/${id}`);
    if (data.status === 'COMPLETED') completedCount++;
  }

  assert(`${completedCount}/20 jobs completed`, completedCount === 20);
}

// ─────────────────────────────────────────────
// Run all tests
// ─────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  Chronos — Full End-to-End Test');
  console.log('═══════════════════════════════════════');

  try {
    await testHealth();
    await testTenants();
    await testJobCompletion();
    await testDelayedJob();
    await testRetryAndDLQ();
    await testIdempotency();
    await testDeletion();
    await testListingAndFiltering();
    await testRateLimiting();
    await testAuthFailures();
    await testValidation();
    await testMetrics();
    await testInvalidIds();
    await testBulkJobs();
  } catch (err: any) {
    console.error('\n  FATAL:', err.message);
    failed++;
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
