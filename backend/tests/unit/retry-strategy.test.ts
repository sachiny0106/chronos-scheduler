import { describe, it, expect } from 'vitest';
import { getNextDelay } from '../../src/core/retry-strategy';
import { RetryBackoff } from '../../src/models/job.model';

describe('getNextDelay', () => {
  it('returns fixed 5s for FIXED strategy regardless of count', () => {
    expect(getNextDelay(0, RetryBackoff.FIXED)).toBe(5000);
    expect(getNextDelay(5, RetryBackoff.FIXED)).toBe(5000);
    expect(getNextDelay(20, RetryBackoff.FIXED)).toBe(5000);
  });

  it('exponential grows: ~5s, ~10s, ~20s, ~40s', () => {
    const d0 = getNextDelay(0, RetryBackoff.EXPONENTIAL);
    const d1 = getNextDelay(1, RetryBackoff.EXPONENTIAL);
    const d2 = getNextDelay(2, RetryBackoff.EXPONENTIAL);
    const d3 = getNextDelay(3, RetryBackoff.EXPONENTIAL);

    // With jitter (10-20%), ranges:
    expect(d0).toBeGreaterThanOrEqual(5000);
    expect(d0).toBeLessThan(7000);

    expect(d1).toBeGreaterThanOrEqual(10000);
    expect(d1).toBeLessThan(14000);

    expect(d2).toBeGreaterThanOrEqual(20000);
    expect(d2).toBeLessThan(28000);

    // Verify ordering
    expect(d1).toBeGreaterThan(d0);
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
  });

  it('caps at 5 minutes (300,000ms)', () => {
    const delay = getNextDelay(20, RetryBackoff.EXPONENTIAL);
    expect(delay).toBeLessThanOrEqual(300_000);
  });

  it('jitter prevents identical delays', () => {
    // Run 10 times — at least 2 should differ (probabilistic but near-certain)
    const delays = Array.from({ length: 10 }, () => getNextDelay(3, RetryBackoff.EXPONENTIAL));
    const unique = new Set(delays);
    expect(unique.size).toBeGreaterThan(1);
  });
});
