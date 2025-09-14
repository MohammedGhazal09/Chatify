import asyncErrHandler from "../Utils/asyncErrHandler.mjs";
import jwt from "jsonwebtoken";
import { CustomError } from "../Utils/customError.mjs";

const protect = asyncErrHandler(async (req, res, next) => {
  let token = req.cookies?.accessToken;
  if (!token) {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
  }
  if (!token) return next(new CustomError("Not authorized to access this route", 401));
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.SECRET_JWT_KEY);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new CustomError("Session expired, please login again", 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
      return next(new CustomError("Invalid token, please login again", 401));
    } else {
      console.log(error.message);
      return next(new CustomError("Token verification failed", 401));
      
    }
  }
  req.userId = decoded.userId;

  // Rolling cookie: if token is close to expiry make a fresh cookie
  // Threshold: 5 minutes
  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const timeRemainingSeconds = (decoded.exp || 0) - nowSeconds;
    const thresholdSeconds = 5 * 60;
    if (timeRemainingSeconds > 0 && timeRemainingSeconds <= thresholdSeconds) {
      const newToken = jwt.sign({ userId: decoded.userId }, process.env.SECRET_JWT_KEY, {
        expiresIn: process.env.EXPIRES_IN || "15m",
      });
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('accessToken', newToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });
    }
  } catch (e) {
    // If anything goes wrong during refresh attempt, do not block the request; proceed
  }
  next();
});

export default protect;
