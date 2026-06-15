import asyncErrHandler from "../Utils/asyncErrHandler.mjs";
import jwt from "jsonwebtoken";
import { CustomError } from "../Utils/customError.mjs";
import { readAccessTokenFromRequest, verifyAccessToken } from "../Utils/authToken.mjs";

const protect = asyncErrHandler(async (req, res, next) => {
  const token = readAccessTokenFromRequest(req);

  if (!token) {
    return next(new CustomError("Not authorized to access this route", 401));
  }
  
  let decoded;
  try {
    ({ decoded } = verifyAccessToken(token));
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new CustomError("Session expired, please login again", 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
      return next(new CustomError("Invalid token, please login again", 401));
    } else {
      return next(new CustomError("Token verification failed", 401));
      
    }
  }
  req.userId = decoded.userId;
  
  next();
});

export default protect;
