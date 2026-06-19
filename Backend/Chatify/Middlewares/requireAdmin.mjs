import User from "../Models/userModel.mjs";
import asyncErrHandler from "../Utils/asyncErrHandler.mjs";
import { CustomError } from "../Utils/customError.mjs";

const requireAdmin = asyncErrHandler(async (req, res, next) => {
  if (!req.userId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const user = await User.findById(req.userId).select("+role");

  if (!user || user.role !== "admin") {
    return next(new CustomError("Admin access required", 403));
  }

  req.adminUserId = user._id.toString();
  next();
});

export default requireAdmin;
