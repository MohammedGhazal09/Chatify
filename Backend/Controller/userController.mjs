import User from '../Models/userModel.mjs'
import asyncErrHandler from '../Utils/asyncErrHandler.mjs'
import { CustomError } from '../Utils/customError.mjs'

export const getLoggedUser = asyncErrHandler(async (req, res, next) => {
  const user = await User.findById(req.userId)
  
  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    user
  });
})

export const getAllUsers = asyncErrHandler(async (req, res, next) => {
  const users = await User.find({_id: {$ne: req.userId}})
  res.status(200).json({
    status: 'success',
    users
  });
})

