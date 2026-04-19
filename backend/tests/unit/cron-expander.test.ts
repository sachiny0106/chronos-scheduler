import { describe, it, expect } from 'vitest';
import { getNextCronRunTime } from '../../src/core/cron-expander';

describe('getNextCronRunTime', () => {
  it('every minute returns ~60s in the future', () => {
    const now = new Date('2025-06-15T12:00:00Z');
    const next = getNextCronRunTime('* * * * *', now);

    expect(next.getTime()).toBe(new Date('2025-06-15T12:01:00Z').getTime());
  });

  it('daily at midnight returns next occurrence', () => {
    const now = new Date('2025-06-15T10:30:00Z');
    const next = getNextCronRunTime('0 0 * * *', now);

    // Should be in the future
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    // Should be within 24 hours
    expect(next.getTime() - now.getTime()).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    expect(next.getMinutes()).toBe(0);
  });

  it('handles already-past time within the day', () => {
    const now = new Date('2025-06-15T23:59:00Z');
    const next = getNextCronRunTime('0 12 * * *', now);

    // Next noon is tomorrow
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(12);
  });

  it('throws on invalid expression', () => {
    expect(() => getNextCronRunTime('invalid')).toThrow();
  });
});
