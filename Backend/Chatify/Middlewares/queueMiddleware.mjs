import { dbQueue, messageQueue } from '../Utils/requestQueue.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

const HEAVY_ROUTES = Object.freeze([
  { prefix: '/api/message/get-all-messages', method: 'GET' },
  { prefix: '/api/chat/get-all-chats', method: 'GET' },
  { prefix: '/api/user/search', method: 'GET' },
]);

/**
 * Get queue status endpoint
 */
export const queueStatus = (_req, res) => {
  res.json({
    status: 'ok',
    queues: {
      database: dbQueue.getStatus(),
      messages: messageQueue.getStatus(),
    },
    timestamp: new Date().toISOString(),
  });
};

const isHeavyRequest = (req) => {
  const pathname = String(req.originalUrl ?? req.url ?? req.path ?? '').split('?')[0];
  return HEAVY_ROUTES.some((route) => (
    req.method === route.method && pathname.startsWith(route.prefix)
  ));
};

/**
 * Bound the complete lifetime of expensive HTTP requests. The queue slot is acquired
 * before Express enters the route and is released only after the response finishes or
 * the connection closes. Queueing a no-op before next() does not constrain database
 * work and is intentionally avoided here.
 */
export const queueHeavyRequests = (req, res, next) => {
  if (!isHeavyRequest(req)) {
    next();
    return;
  }

  req.queuedAt = Date.now();

  void dbQueue.add(() => new Promise((resolve, reject) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      res.off('finish', release);
      res.off('close', release);
      resolve();
    };

    res.once('finish', release);
    res.once('close', release);
    req.isQueued = true;

    try {
      next();
    } catch (error) {
      release();
      reject(error);
    }
  })).catch((error) => {
    logger.error('queue.heavy_route_failed', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl ?? req.path,
      error,
    });

    if (!res.headersSent) {
      res.status(503).json({
        status: 'error',
        message: 'Server is busy. Please try again.',
      });
    }
  });
};

/**
 * Add queue timing headers to response
 */
export const addQueueHeaders = (req, res, next) => {
  if (req.isQueued && req.queuedAt && !res.headersSent) {
    const waitTime = Date.now() - req.queuedAt;
    res.setHeader('X-Queue-Wait-Time', waitTime.toString());
  }
  next();
};

/**
 * Add message operations to the bounded message queue.
 */
export const queueMessageOperations = async (operation) => messageQueue.add(operation);

export default {
  queueStatus,
  queueHeavyRequests,
  addQueueHeaders,
  queueMessageOperations,
};
