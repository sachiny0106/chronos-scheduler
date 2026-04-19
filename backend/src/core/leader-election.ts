import { EventEmitter } from 'events';
import crypto from 'crypto';
import { createRedisClient } from '../lib/redis';
import { config } from '../config';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('leader');

const LEADER_KEY = 'scheduler:leader';

export class LeaderElection extends EventEmitter {
  readonly instanceId: string;
  private redis;
  private timer: NodeJS.Timeout | null = null;
  private _isLeader = false;
  private stopped = false;

  constructor() {
    super();
    this.instanceId = `sched-${crypto.randomBytes(4).toString('hex')}`;
    this.redis = createRedisClient(`leader-${this.instanceId}`);
  }

  get isLeader(): boolean {
    return this._isLeader;
  }

  async start(): Promise<void> {
    await this.redis.connect();
    log.info({ instanceId: this.instanceId }, 'started');

    await this.tryAcquire();

    // Election loop at TTL/3 — fast enough for failover, not too chatty
    const intervalMs = Math.floor(config.scheduler.leaderLeaseTtlMs / 3);
    this.timer = setInterval(() => this.tryAcquire(), intervalMs);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    // Release leadership atomically — only delete if we still own it
    if (this._isLeader) {
      try {
        await this.redis.eval(
          `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
          1, LEADER_KEY, this.instanceId
        );
      } catch {}
      this._isLeader = false;
      log.info({ instanceId: this.instanceId }, 'leadership released');
    }

    await this.redis.quit();
  }

  private async tryAcquire(): Promise<void> {
    if (this.stopped) return;

    try {
      if (this._isLeader) {
        // Renew: only if we still own the key (Lua CAS to prevent split-brain)
        const renewed = await this.redis.eval(
          `if redis.call("get", KEYS[1]) == ARGV[1] then redis.call("pexpire", KEYS[1], ARGV[2]) return 1 else return 0 end`,
          1, LEADER_KEY, this.instanceId, String(config.scheduler.leaderLeaseTtlMs)
        );

        if (renewed === 0) {
          this._isLeader = false;
          log.warn({ instanceId: this.instanceId }, 'leadership lost');
          this.emit('demoted');
        }
      } else {
        // Try to acquire
        const result = await this.redis.set(
          LEADER_KEY, this.instanceId,
          'PX', config.scheduler.leaderLeaseTtlMs,
          'NX'
        );

        if (result === 'OK') {
          this._isLeader = true;
          log.info({ instanceId: this.instanceId }, 'leadership acquired');
          this.emit('elected');
        }
      }
    } catch (err: any) {
      log.error({ err: err.message }, 'election error');
    }
  }
}
