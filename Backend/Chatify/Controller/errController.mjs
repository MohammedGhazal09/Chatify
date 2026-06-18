import { CustomError } from "../Utils/customError.mjs";

const developmentErrors = (error, req, res) => {
  const sanitizedBody = { ...req.body };
  delete sanitizedBody.password;
  delete sanitizedBody.confirmPassword;
  delete sanitizedBody.token;
  delete sanitizedBody.code;
  delete sanitizedBody.newPassword;
  delete sanitizedBody.email;
  delete sanitizedBody.refreshToken;
  delete sanitizedBody.accessToken;
  delete sanitizedBody.identityMark;
  delete sanitizedBody.identity;
  delete sanitizedBody.profilePic;
  delete sanitizedBody.profileImage;

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
    user: req.user ? { id: req.user.id } : null,
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
  const fields = Object.keys(error.keyValue ?? {}).join(', ') || 'field';
  const message = `Duplicate value for ${fields}. Please use another value!`;
  return new CustomError(message, 400);
}

const handleValidationError = (error) => { 
  const errors = Object.values(error.errors).map((el) => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new CustomError(message, 400);
}

const errHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return developmentErrors(err, req, res);
  }

  if (err.code === 11000) err = handleDuplicateKeyError(err);
  if (err.name === 'ValidationError') err = handleValidationError(err);
  return productionErrors(err, req, res);
};
export default errHandler
