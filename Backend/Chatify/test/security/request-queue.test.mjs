import { describe, expect, it, vi } from 'vitest';
import RequestQueue, { QueueCapacityError } from '../../Utils/requestQueue.mjs';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

describe('bounded request queue', () => {
  it('holds capacity until the queued operation actually completes', async () => {
    const queue = new RequestQueue(1, 0, 2);
    const gate = deferred();
    const first = queue.add(() => gate.promise);
    const secondExecute = vi.fn(() => 'second');
    const second = queue.add(secondExecute);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(queue.getStatus()).toMatchObject({ active: 1, queued: 1, capacity: 2 });
    expect(secondExecute).not.toHaveBeenCalled();

    gate.resolve('first');
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
  });

  it('fails closed when the bounded backlog is full', async () => {
    const queue = new RequestQueue(1, 0, 1);
    const gate = deferred();
    const first = queue.add(() => gate.promise);
    const second = queue.add(() => 'second');

    await expect(queue.add(() => 'overflow')).rejects.toBeInstanceOf(QueueCapacityError);
    expect(queue.getStatus()).toMatchObject({ active: 1, queued: 1, capacity: 1 });

    gate.resolve('first');
    await first;
    await second;
  });
});
