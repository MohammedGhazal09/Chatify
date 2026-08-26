import { afterEach, describe, expect, it, vi } from 'vitest';
import { SocketEventRateLimiter } from '../../Utils/socketEventRateLimiter.mjs';

describe('SocketEventRateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('limits a key until its fixed window expires', () => {
    const limiter = new SocketEventRateLimiter({ maxEntries: 10 });

    expect(limiter.consume({ key: 'user:1:call:start', max: 2, windowMs: 1000, now: 0 })).toBe(true);
    expect(limiter.consume({ key: 'user:1:call:start', max: 2, windowMs: 1000, now: 1 })).toBe(true);
    expect(limiter.consume({ key: 'user:1:call:start', max: 2, windowMs: 1000, now: 2 })).toBe(false);
    expect(limiter.consume({ key: 'user:1:call:start', max: 2, windowMs: 1000, now: 1000 })).toBe(true);
  });

  it('sweeps expired user-scoped entries without requiring a disconnect', () => {
    const limiter = new SocketEventRateLimiter({ maxEntries: 10 });

    limiter.consume({ key: 'user:1:call:start', max: 2, windowMs: 1000, now: 0 });
    limiter.consume({ key: 'user:2:call:start', max: 2, windowMs: 2000, now: 0 });

    expect(limiter.sweep(1000)).toBe(1);
    expect(limiter.size).toBe(1);
    expect(limiter.sweep(2000)).toBe(1);
    expect(limiter.size).toBe(0);
  });

  it('evicts the soonest-expiring entry before exceeding its hard bound', () => {
    const limiter = new SocketEventRateLimiter({ maxEntries: 2 });

    limiter.consume({ key: 'user:a:event', max: 1, windowMs: 1000, now: 0 });
    limiter.consume({ key: 'user:b:event', max: 1, windowMs: 2000, now: 0 });
    limiter.consume({ key: 'user:c:event', max: 1, windowMs: 3000, now: 0 });

    expect(limiter.size).toBe(2);
    expect(limiter.consume({ key: 'user:a:event', max: 1, windowMs: 1000, now: 1 })).toBe(true);
  });

  it('clears only socket-scoped windows for a disconnected socket', () => {
    const limiter = new SocketEventRateLimiter({ maxEntries: 10 });

    limiter.consume({ key: 'socket:abc:typing:start', max: 1, windowMs: 1000, now: 0 });
    limiter.consume({ key: 'user:1:call:start', max: 1, windowMs: 1000, now: 0 });

    expect(limiter.deletePrefix('socket:abc:')).toBe(1);
    expect(limiter.size).toBe(1);
  });

  it('starts and stops one unrefed periodic sweep', () => {
    vi.useFakeTimers();
    const limiter = new SocketEventRateLimiter({ sweepIntervalMs: 1000 });

    const first = limiter.startSweep();
    const second = limiter.startSweep();

    expect(first).toBe(second);
    expect(limiter.sweepActive).toBe(true);
    limiter.stopSweep();
    expect(limiter.sweepActive).toBe(false);
  });
});
