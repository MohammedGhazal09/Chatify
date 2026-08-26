import { dbQueue, messageQueue } from '../Utils/requestQueue.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

const HEAVY_ROUTES = Object.freeze([
  { path: '/api/message/get-all-messages', method: 'GET' },
  { path: '/api/chat/get-all-chats', method: 'GET' },
  { path: '/api/user/search', method: 'GET' },
]);

const isHeavyRequest = (req) => HEAVY_ROUTES.some((route) => (
  req.path.includes(route.path) && req.method === route.method
));

/**
 * Get queue status endpoint.
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

/**
 * Hold a database concurrency slot until the complete downstream response finishes
 * or the client disconnects. The previous implementation released the slot before
 * calling next(), so no database work was actually bounded.
 */
export const queueHeavyRequests = (req, res, next) => {
  if (!isHeavyRequest(req)) {
    next();
    return;
  }

  req.queuedAt = Date.now();

  dbQueue.add(() => new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      res.off('finish', complete);
      res.off('close', complete);
    };
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const complete = () => settle(resolve);

    res.once('finish', complete);
    res.once('close', complete);
    req.isQueued = true;

    try {
      next();
    } catch (error) {
      settle(() => reject(error));
    }
  })).catch((error) => {
    logger.error('queue.heavy_route_failed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      error,
    });

    if (!res.headersSent) {
      next(error);
    }
  });
};

/**
 * Add queue timing headers to response.
 */
export const addQueueHeaders = (req, res, next) => {
  if (req.isQueued && req.queuedAt) {
    const waitTime = Date.now() - req.queuedAt;
    res.setHeader('X-Queue-Wait-Time', waitTime.toString());
  }
  next();
};

/**
 * Add a complete message operation to the message queue.
 */
export const queueMessageOperations = async (operation) => messageQueue.add(operation);

export default {
  queueStatus,
  queueHeavyRequests,
  addQueueHeaders,
  queueMessageOperations,
};
