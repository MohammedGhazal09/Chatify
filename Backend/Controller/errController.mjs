import { CustomError } from "../utils/customError.mjs";

const developmentErrors = (error, req, res) => {
  // Filter sensitive data from body
  const sanitizedBody = { ...req.body };
  delete sanitizedBody.password;
  delete sanitizedBody.confirmPassword;
  delete sanitizedBody.token;

  return res.status(error.statusCode).json({
    status: error.status || (error.statusCode >= 500 ? "error" : "fail"),
    message: error.message,
    stack: error.stack,
    error: error,
    code: error.code || null,
    path: error.path || null,
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
    requestId: req.requestId || null,
    user: req.user ? { id: req.user.id, email: req.user.email } : null,
    headers: {
      "User-Agent": req.headers["user-agent"],
      "Content-Type": req.headers["content-type"],
      Accept: req.headers["accept"],
    },
    query: req.query || {},
    body: sanitizedBody,
  });
};

const productionErrors = (error, req, res) => {
  if (error.isOperational) {
    return res.status(error.statusCode).json({
      status: error.status || (error.statusCode >= 500 ? "error" : "fail"),
      message: error.message,
      code: error.code || null,
    });
  } else {
    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

const handleDuplicateKeyError = (error) => {
  const message = `Duplicate field value: ${error.keyValue}. Please use another value!`;
  return new CustomError(message, 400);
}

const handleValidationError = (error) => { 
  const errors = Object.values(error.errors).map((el) => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new CustomError(message, 400);
}

const errHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;

  if (process.env.NODE_ENV === 'development') {
    return developmentErrors(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    if (err.code === 11000) err = handleDuplicateKeyError(err);
    if (err.name === 'ValidationError') err = handleValidationError(err);
    return productionErrors(err, req, res);
  } else {
    // Fallback for unknown NODE_ENV
    return res.status(500).json({
      status: "error",
      message: "Server configuration error"
    });
  }
};
export default errHandler
