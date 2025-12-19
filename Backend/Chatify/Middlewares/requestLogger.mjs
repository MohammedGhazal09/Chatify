// Request logging middleware for monitoring and debugging

const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Generate unique request ID
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;

  // Log incoming request
  console.log(`📨 [${requestId}] ${req.method} ${req.originalUrl}`);

  // Capture response when it finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusColor = res.statusCode >= 400 ? '🔴' : res.statusCode >= 300 ? '🟡' : '🟢';
    
    console.log(`${statusColor} [${requestId}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });

  next();
};

// Error request logger - logs failed requests with more detail
const errorRequestLogger = (err, req, res, next) => {
  console.error(`❌ [${req.requestId || 'unknown'}] Error:`, {
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
  next(err);
};

export { requestLogger, errorRequestLogger };
