import { dbQueue, messageQueue, QueueCapacityError } from '../Utils/requestQueue.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

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
  const heavyRoutes = [
    { path: '/api/message/get-all-messages', method: 'GET' },
    { path: '/api/chat/get-all-chats', method: 'GET' },
    { path: '/api/user/search', method: 'GET' },
  ];

  return heavyRoutes.some((route) => (
    req.path.includes(route.path) && req.method === route.method
  ));
};

const runRequestInsideQueueSlot = (req, res, next) => new Promise((resolve, reject) => {
  let settled = false;

  const complete = () => {
    if (settled) {
      return;
    }

    settled = true;
    res.off('finish', complete);
    res.off('close', complete);
    resolve();
  };

  res.once('finish', complete);
  res.once('close', complete);
  req.isQueued = true;

  try {
    next();
  } catch (error) {
    complete();
    reject(error);
  }
});

export const queueHeavyRequests = (req, res, next) => {
  if (!isHeavyRequest(req)) {
    next();
    return;
  }

  req.queuedAt = Date.now();

  dbQueue
    .add(() => runRequestInsideQueueSlot(req, res, next))
    .catch((error) => {
      logger.error('queue.heavy_route_failed', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        error,
      });

      if (res.headersSent) {
        res.destroy(error);
        return;
      }

      res.status(error instanceof QueueCapacityError ? 503 : 500).json({
        status: 'error',
        message: error instanceof QueueCapacityError
          ? 'Server is busy. Please try again.'
          : 'Request processing failed.',
      });
    });
};

export const addQueueHeaders = (req, res, next) => {
  if (req.isQueued && req.queuedAt) {
    const waitTime = Date.now() - req.queuedAt;
    res.setHeader('X-Queue-Wait-Time', waitTime.toString());
  }
  next();
};

export const queueMessageOperations = async (operation) => messageQueue.add(operation);

export default {
  queueStatus,
  queueHeavyRequests,
  addQueueHeaders,
  queueMessageOperations,
};
