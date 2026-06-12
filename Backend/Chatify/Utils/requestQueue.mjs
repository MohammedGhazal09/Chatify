class RequestQueue {
  constructor(maxConcurrent = 10, requestDelay = 10) {
    this.queue = [];
    this.activeRequests = 0;
    this.maxConcurrent = maxConcurrent;
    this.requestDelay = requestDelay;
    this.isPaused = false;
  }

  async add(execute, priority = 0) {
    return new Promise((resolve, reject) => {
      const request = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        execute,
        resolve,
        reject,
        priority,
        timestamp: Date.now(),
      };

      // Insert based on priority (higher priority first)
      const insertIndex = this.queue.findIndex(r => r.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isPaused) return;
    if (this.activeRequests >= this.maxConcurrent) return;
    if (this.queue.length === 0) return;

    const request = this.queue.shift();
    if (!request) return;

    this.activeRequests++;

    try {
      if (this.requestDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }

      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  pause() {
    this.isPaused = true;
    console.log('⏸️ Queue paused');
  }

  resume() {
    this.isPaused = false;
    console.log('▶️ Queue resumed');
    this.processQueue();
  }

  clear() {
    const count = this.queue.length;
    this.queue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    console.log(`🗑️ Queue cleared. Removed ${count} requests`);
  }

  getStatus() {
    return {
      queued: this.queue.length,
      active: this.activeRequests,
      isPaused: this.isPaused,
    };
  }
}

// Database operations queue (20 concurrent, 5ms delay)
export const dbQueue = new RequestQueue(20, 5);

// Email sending queue (3 concurrent, 100ms delay)
export const emailQueue = new RequestQueue(3, 100);

// Socket broadcast queue (50 concurrent, no delay)
export const socketQueue = new RequestQueue(50, 0);

// Message processing queue (15 concurrent, 10ms delay)
export const messageQueue = new RequestQueue(15, 10);

export default RequestQueue;
