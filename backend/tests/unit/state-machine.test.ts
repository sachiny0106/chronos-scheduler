import { describe, it, expect } from 'vitest';
import { isValidTransition } from '../../src/core/state-machine';
import { JobStatus } from '../../src/models/job.model';

describe('state-machine transitions', () => {
  const valid: [JobStatus, JobStatus][] = [
    [JobStatus.PENDING, JobStatus.SCHEDULED],
    [JobStatus.SCHEDULED, JobStatus.QUEUED],
    [JobStatus.QUEUED, JobStatus.RUNNING],
    [JobStatus.RUNNING, JobStatus.COMPLETED],
    [JobStatus.RUNNING, JobStatus.FAILED],
    [JobStatus.FAILED, JobStatus.RETRYING],
    [JobStatus.FAILED, JobStatus.DEAD_LETTER],
    [JobStatus.RETRYING, JobStatus.SCHEDULED],
    [JobStatus.DEAD_LETTER, JobStatus.PENDING],
  ];

  const invalid: [JobStatus, JobStatus][] = [
    [JobStatus.PENDING, JobStatus.RUNNING],
    [JobStatus.COMPLETED, JobStatus.RUNNING],
    [JobStatus.QUEUED, JobStatus.COMPLETED],
    [JobStatus.DEAD_LETTER, JobStatus.RUNNING],
    [JobStatus.RETRYING, JobStatus.QUEUED],
    [JobStatus.RUNNING, JobStatus.QUEUED],
    [JobStatus.SCHEDULED, JobStatus.FAILED],
  ];

  valid.forEach(([from, to]) => {
    it(`allows ${from} → ${to}`, () => {
      expect(isValidTransition(from, to)).toBe(true);
    });
  });

  invalid.forEach(([from, to]) => {
    it(`rejects ${from} → ${to}`, () => {
      expect(isValidTransition(from, to)).toBe(false);
    });
  });

  it('rejects self-transitions', () => {
    Object.values(JobStatus).forEach((status) => {
      expect(isValidTransition(status, status)).toBe(false);
    });
  });

  it('completed is terminal', () => {
    Object.values(JobStatus).forEach((to) => {
      expect(isValidTransition(JobStatus.COMPLETED, to)).toBe(false);
    });
  });
});
