import { logger } from './observabilityLogger.mjs';

export class QueueCapacityError extends Error {
  constructor(message = 'Request queue capacity exceeded') {
    super(message);
    this.name = 'QueueCapacityError';
    this.code = 'QUEUE_CAPACITY_EXCEEDED';
  }
}

class RequestQueue {
  constructor(maxConcurrent = 10, requestDelay = 10, maxQueueSize = 100) {
    this.queue = [];
    this.activeRequests = 0;
    this.maxConcurrent = maxConcurrent;
    this.requestDelay = requestDelay;
    this.maxQueueSize = maxQueueSize;
    this.isPaused = false;
  }

  async add(execute, priority = 0) {
    if (typeof execute !== 'function') {
      throw new TypeError('Queued request must be a function');
    }

    if (this.queue.length >= this.maxQueueSize) {
      throw new QueueCapacityError();
    }

    return new Promise((resolve, reject) => {
      const request = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        execute,
        resolve,
        reject,
        priority,
        timestamp: Date.now(),
      };

      const insertIndex = this.queue.findIndex((queuedRequest) => queuedRequest.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      this.processQueue();
    });
  }

  processQueue() {
    if (this.isPaused) {
      return;
    }

    while (this.activeRequests < this.maxConcurrent && this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) {
        return;
      }

      this.activeRequests += 1;
      void this.executeRequest(request);
    }
  }

  async executeRequest(request) {
    try {
      if (this.requestDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.requestDelay));
      }

      request.resolve(await request.execute());
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests -= 1;
      this.processQueue();
    }
  }

  pause() {
    this.isPaused = true;
    logger.warn('queue.paused', this.getStatus());
  }

  resume() {
    this.isPaused = false;
    logger.info('queue.resumed', this.getStatus());
    this.processQueue();
  }

  clear() {
    const count = this.queue.length;
    this.queue.forEach((request) => {
      request.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    logger.warn('queue.cleared', {
      clearedCount: count,
      ...this.getStatus(),
    });
  }

  getStatus() {
    return {
      queued: this.queue.length,
      active: this.activeRequests,
      capacity: this.maxQueueSize,
      maxConcurrent: this.maxConcurrent,
      isPaused: this.isPaused,
    };
  }
}

export const dbQueue = new RequestQueue(20, 5, 200);
export const emailQueue = new RequestQueue(3, 100, 100);
export const socketQueue = new RequestQueue(50, 0, 500);
export const messageQueue = new RequestQueue(15, 10, 250);

export default RequestQueue;
