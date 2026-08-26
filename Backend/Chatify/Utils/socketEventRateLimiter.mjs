const DEFAULT_MAX_ENTRIES = 10_000;
const DEFAULT_SWEEP_INTERVAL_MS = 60_000;

const normalizePositiveInteger = (value, fallback) => (
  Number.isSafeInteger(value) && value > 0 ? value : fallback
);

export class SocketEventRateLimiter {
  #windows = new Map();
  #maxEntries;
  #sweepIntervalMs;
  #sweepTimer = null;

  constructor({
    maxEntries = DEFAULT_MAX_ENTRIES,
    sweepIntervalMs = DEFAULT_SWEEP_INTERVAL_MS,
  } = {}) {
    this.#maxEntries = normalizePositiveInteger(maxEntries, DEFAULT_MAX_ENTRIES);
    this.#sweepIntervalMs = normalizePositiveInteger(
      sweepIntervalMs,
      DEFAULT_SWEEP_INTERVAL_MS
    );
  }

  get size() {
    return this.#windows.size;
  }

  get sweepActive() {
    return Boolean(this.#sweepTimer);
  }

  #enforceBound(now) {
    this.sweep(now);

    if (this.#windows.size < this.#maxEntries) {
      return;
    }

    const oldestFirst = [...this.#windows.entries()]
      .sort((left, right) => (
        left[1].resetAt - right[1].resetAt
        || left[0].localeCompare(right[0])
      ));
    const removeCount = this.#windows.size - this.#maxEntries + 1;

    for (let index = 0; index < removeCount; index += 1) {
      this.#windows.delete(oldestFirst[index][0]);
    }
  }

  consume({ key, max, windowMs, now = Date.now() } = {}) {
    if (
      typeof key !== 'string'
      || !key
      || !Number.isSafeInteger(max)
      || max < 1
      || !Number.isSafeInteger(windowMs)
      || windowMs < 1
      || !Number.isFinite(now)
    ) {
      throw new TypeError('Socket event rate-limit inputs are invalid');
    }

    const current = this.#windows.get(key);

    if (!current || now >= current.resetAt) {
      if (!current) {
        this.#enforceBound(now);
      }

      this.#windows.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return true;
    }

    if (current.count >= max) {
      return false;
    }

    current.count += 1;
    return true;
  }

  deletePrefix(prefix) {
    if (typeof prefix !== 'string' || !prefix) {
      return 0;
    }

    let deleted = 0;
    for (const key of this.#windows.keys()) {
      if (key.startsWith(prefix)) {
        deleted += this.#windows.delete(key) ? 1 : 0;
      }
    }
    return deleted;
  }

  sweep(now = Date.now()) {
    let deleted = 0;

    for (const [key, window] of this.#windows.entries()) {
      if (!window || !Number.isFinite(window.resetAt) || now >= window.resetAt) {
        deleted += this.#windows.delete(key) ? 1 : 0;
      }
    }

    if (this.#windows.size > this.#maxEntries) {
      const oldestFirst = [...this.#windows.entries()]
        .sort((left, right) => (
          left[1].resetAt - right[1].resetAt
          || left[0].localeCompare(right[0])
        ));
      const removeCount = this.#windows.size - this.#maxEntries;

      for (let index = 0; index < removeCount; index += 1) {
        deleted += this.#windows.delete(oldestFirst[index][0]) ? 1 : 0;
      }
    }

    return deleted;
  }

  startSweep() {
    if (this.#sweepTimer) {
      return this.#sweepTimer;
    }

    this.#sweepTimer = setInterval(() => {
      this.sweep();
    }, this.#sweepIntervalMs);
    this.#sweepTimer.unref?.();
    return this.#sweepTimer;
  }

  stopSweep() {
    if (!this.#sweepTimer) {
      return;
    }

    clearInterval(this.#sweepTimer);
    this.#sweepTimer = null;
  }

  clear() {
    this.#windows.clear();
  }
}
