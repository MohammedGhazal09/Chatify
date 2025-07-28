import User from '../Models/userModel.mjs'
import asyncErrHandler from '../Utils/asyncErrHandler.mjs'

export const getLoggedUser = asyncErrHandler(async (req, res, next) => {
  const user = await User.findById(req.userId)
  
  res.status(200).json({
    status: 'success',
    user
  });
})
s
export const getAllUsers = asyncErrHandler(async (req, res, next) => {
  const user = await User.find({_id: {$ne: req.userId}})
  res.status(200).json({
    status: 'success',
    user
  });
})

