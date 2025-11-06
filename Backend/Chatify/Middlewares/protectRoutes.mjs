import asyncErrHandler from "../Utils/asyncErrHandler.mjs";
import jwt from "jsonwebtoken";
import { CustomError } from "../Utils/customError.mjs";

const protect = asyncErrHandler(async (req, res, next) => {
  console.log('\n🛡️ === Protected Route Check ===');
  console.log('📍 Route:', req.method, req.path);
  
  let token = req.cookies?.accessToken;
  
  console.log('🍪 Cookie accessToken present:', !!token);
  
  if (!token) {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
      console.log('🔑 Token from Authorization header:', !!token);
    }
  }
  
  if (token) {
    console.log('🔑 Token length:', token.length);
    console.log('🔑 Token preview:', token.substring(0, 20) + '...');
  } else {
    console.log('❌ No token found in cookies or headers');
    console.log('🍪 Available cookies:', Object.keys(req.cookies || {}));
  }
  
  if (!token) {
    console.log('🛡️ === Protected Route Failed: No Token ===\n');
    return next(new CustomError("Not authorized to access this route", 401));
  }
  
  let decoded;
  try {
    console.log('🔓 Verifying token...');
    decoded = jwt.verify(token, process.env.SECRET_JWT_KEY);
    console.log('✅ Token verified, user ID:', decoded.userId);
  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    console.log('🛡️ === Protected Route Failed: Verification Error ===\n');
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
    console.log('⏱️ Token time remaining:', timeRemainingSeconds, 'seconds');
    if (timeRemainingSeconds > 0 && timeRemainingSeconds <= thresholdSeconds) {
      console.log('🔄 Refreshing token (close to expiry)...');
      const newToken = jwt.sign({ userId: decoded.userId }, process.env.SECRET_JWT_KEY, {
        expiresIn: process.env.EXPIRES_IN || "15m",
      });
      const isProd = process.env.NODE_ENV === 'production';
      console.log('🔒 New token cookie - Secure:', isProd, 'SameSite: none');
      res.cookie('accessToken', newToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'none',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });
      console.log('✅ Token refreshed successfully');
    }
  } catch (e) {
    console.log('⚠️ Token refresh attempt failed:', e.message);
    // If anything goes wrong during refresh attempt, do not block the request; proceed
  }
  
  console.log('✅ User authenticated successfully');
  console.log('🛡️ === Protected Route Success ===\n');
  next();
});

export default protect;
