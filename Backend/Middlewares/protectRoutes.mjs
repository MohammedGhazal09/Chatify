import asyncErrHandler from "../Utils/asyncErrHandler.mjs";
import jwt from "jsonwebtoken";
import { CustomError } from "../Utils/customError.mjs";

const protect = asyncErrHandler(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token)
    return next(new CustomError("Not authorized to access this route", 401));
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
  next();
});

export default protect;
