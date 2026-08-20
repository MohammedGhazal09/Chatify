import { createRequestId, logger } from '../Utils/observabilityLogger.mjs';

const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = createRequestId(req.get('x-request-id'));
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  logger.info('http.request.started', {
    requestId,
    method: req.method,
    path: req.path,
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info('http.request.finished', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
    });
  });

  next();
};

const errorRequestLogger = (err, req, res, next) => {
  logger.error('http.request.error', {
    requestId: req.requestId || 'unknown',
    method: req.method,
    path: req.path,
    statusCode: err.statusCode,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
  next(err);
};

export { requestLogger, errorRequestLogger };
