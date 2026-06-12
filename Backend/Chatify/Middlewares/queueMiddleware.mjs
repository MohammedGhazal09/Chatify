import { dbQueue, messageQueue } from '../Utils/requestQueue.mjs';

/**
 * Get queue status endpoint
 */
export const queueStatus = (req, res) => {
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
 * Middleware to queue heavy database requests
 * This prevents database overload during high traffic
 */
export const queueHeavyRequests = (req, res, next) => {
  // Routes that involve heavy database operations
  const heavyRoutes = [
    { path: '/api/message/get-all-messages', method: 'GET' },
    { path: '/api/chat/get-all-chats', method: 'GET' },
    { path: '/api/user/search', method: 'GET' },
  ];

  const isHeavyRoute = heavyRoutes.some(route => 
    req.path.includes(route.path) && req.method === route.method
  );

  if (isHeavyRoute) {
    // Add to queue
    req.queuedAt = Date.now();
    
    dbQueue.add(async () => {
      return new Promise((resolve) => {
        req.isQueued = true;
        resolve();
      });
    }).then(() => {
      next();
    }).catch((error) => {
      console.error('Queue error:', error);
      res.status(503).json({
        status: 'error',
        message: 'Server is busy. Please try again.',
      });
    });
  } else {
    next();
  }
};

/**
 * Add queue timing headers to response
 */
export const addQueueHeaders = (req, res, next) => {
  if (req.isQueued && req.queuedAt) {
    const waitTime = Date.now() - req.queuedAt;
    res.setHeader('X-Queue-Wait-Time', waitTime.toString());
  }
  next();
};

/**
 * Queue message operations to prevent flooding
 */
export const queueMessageOperations = async (operation) => {
  return messageQueue.add(operation);
};

export default {
  queueStatus,
  queueHeavyRequests,
  addQueueHeaders,
  queueMessageOperations,
};
