import { json } from 'express';
import User from '../Models/userModel.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import {CustomError} from '../Utils/customError.mjs';
import jsonwebtoken from 'jsonwebtoken'

export const signup =asyncErrHandler( async (req, res, next) => {
  let { firstName, lastName, email, password, profilePic } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return next(new CustomError('Please provide all the required fields', 400));
  }

  const exUser = await User.findOne({email:email})
  if (exUser) {
    return next(new CustomError('User already exists with this email', 400));
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    profilePic
  })
  return res.status(201).json({
    success: true,
    message: 'User created successfully',
  });
}
)

export const login = asyncErrHandler(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new CustomError('Please provide email and password', 400));
  }
  const user = await User.findOne({email:email}).select("+password")
  if (!user) return next(CustomError("User doesn't exist",401))
  const credentials = await user.checkPassword(password)
  const token = jsonwebtoken.sign({userId:user._id},process.env.SECRET_JWT_KEY,{expiresIn:process.env.EXPIRES_IN})
  if (credentials) {
    return res.status(200).json({
      status:"success",
      message:"Logged in successfully!",
      token
    })
  } else {
    return next(new CustomError("Password or email are wrong", 400))
  }
})
