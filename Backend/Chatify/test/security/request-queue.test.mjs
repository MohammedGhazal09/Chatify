import { describe, expect, it } from 'vitest';
import RequestQueue from '../../Utils/requestQueue.mjs';

describe('request queue capacity', () => {
  it('rejects excess queued work with a service-unavailable error', async () => {
    const queue = new RequestQueue(1, 0, 1);
    let releaseFirst;
    const first = queue.add(() => new Promise((resolve) => {
      releaseFirst = resolve;
    }));
    const second = queue.add(async () => 'second');
    const excess = queue.add(async () => 'excess');

    releaseFirst('first');

    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    await expect(excess).rejects.toMatchObject({
      code: 'queue_full',
      statusCode: 503,
    });
  });
});
