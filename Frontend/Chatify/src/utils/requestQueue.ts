type QueuedRequest = {
  id: string;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  priority: number;
  timestamp: number;
};

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private activeRequests = 0;
  private maxConcurrent: number;
  private requestDelay: number;
  private isPaused = false;

  constructor(maxConcurrent = 5, requestDelay = 50) {
    this.maxConcurrent = maxConcurrent;
    this.requestDelay = requestDelay;
  }

  /**
   * Add a request to the queue
   * @param execute - Function that returns a promise
   * @param priority - Higher = processed first (default 0)
   */
  async add<T>(execute: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        execute,
        resolve: resolve as (value: unknown) => void,
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

  private async processQueue(): Promise<void> {
    if (this.isPaused) return;
    if (this.activeRequests >= this.maxConcurrent) return;
    if (this.queue.length === 0) return;

    const request = this.queue.shift();
    if (!request) return;

    this.activeRequests++;

    try {
      // Add small delay to prevent burst
      if (this.requestDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }

      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests--;
      // Process next request
      this.processQueue();
    }
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.isPaused = false;
    this.processQueue();
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.queue.forEach(request => {
      request.reject(new Error('Request cancelled - queue cleared'));
    });
    this.queue = [];
  }

  /**
   * Get queue status
   */
  getStatus(): { queued: number; active: number; isPaused: boolean } {
    return {
      queued: this.queue.length,
      active: this.activeRequests,
      isPaused: this.isPaused,
    };
  }
}

// Main request queue (5 concurrent, 50ms delay)
export const requestQueue = new RequestQueue(5, 50);

// High priority queue for auth requests (2 concurrent, no delay)
export const authQueue = new RequestQueue(2, 0);

// Low priority queue for background tasks (3 concurrent, 100ms delay)
export const backgroundQueue = new RequestQueue(3, 100);

export default RequestQueue;
