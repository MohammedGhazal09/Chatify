import User from '../Models/userModel.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import {CustomError} from '../Utils/customError.mjs';
import jsonwebtoken from 'jsonwebtoken'
import passport from 'passport';

const generateTokenAndSetCookie = (user, res, rememberMe = false) => {
  const expiresIn = rememberMe ? '30d' : process.env.EXPIRES_IN || '15m';
  const token = jsonwebtoken.sign({userId:user._id}, process.env.SECRET_JWT_KEY, {expiresIn});

  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000;
  
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge,
    path: '/'
  })

  return token
}

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
    profilePic,
    authProvider: 'local',
  })

  generateTokenAndSetCookie(user, res);
  return res.status(201).json({
    success: true,
    message: 'User created successfully',
  });
}
)

export const login = asyncErrHandler(async (req, res, next) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password) {
    return next(new CustomError('Please provide email and password', 400));
  }
  const user = await User.findOne({email:email, authProvider: 'local'}).select("+password")
  if (!user) return next(new CustomError("User doesn't exist",401))
  const credentials = await user.checkPassword(password)
  if (!credentials) {
    return next(new CustomError("Password or email are wrong", 400))
  }

  generateTokenAndSetCookie(user, res, rememberMe);

  return res.status(200).json({
    status:"success",
    message:"Logged in successfully!",
  })
})

export const logout = asyncErrHandler(async (req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });
  return res.status(204).end();
})

export const refreshToken = asyncErrHandler(async (req, res, next) => {
  const token = req.cookies.accessToken;
  
  if (!token) {
    return next(new CustomError('No token provided', 401));
  }
  
  let decoded;
  try {
    // Try to verify the token
    decoded = jsonwebtoken.verify(token, process.env.SECRET_JWT_KEY);
  } catch (error) {
    if (error instanceof jsonwebtoken.TokenExpiredError) {
      // Token is expired, but we can still decode it to get userId
      decoded = jsonwebtoken.decode(token);
      if (!decoded || !decoded.userId) {
        return next(new CustomError('Invalid token', 401));
      }
    } else {
      return next(new CustomError('Invalid token', 401));
    }
  }
  
  const user = await User.findById(decoded.userId);
  if (!user) {
    return next(new CustomError('User not found', 404));
  }
  generateTokenAndSetCookie(user, res)

  return res.status(200).json({ status: 'success', message: 'Token refreshed successfully' });
});

export const isAuthenticated = asyncErrHandler(async (req, res, next) => {
  const token = !!req.cookies.accessToken
  res.status(200).json({
    status:"success",
    message:"User is authenticated",
    token
  }).end()
})

export const googleAuth = passport.authenticate('google', {scope: ['profile', 'email']})

export const googleAuthCallback = (req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';

  passport.authenticate('google', {session: false}, (err, user, info) => {
    if (err || !user) {

      if (!isProd) { // if its dev env then show the problem
        console.error('Google OAuth Error', err);
      }

      return res.redirect(`${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/login?error=oauth_error`)
    }

    generateTokenAndSetCookie(user, res, true); // rememberMe is true for OAuth logins

    return res.redirect(`${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/?auth=success`)
  })(req, res, next)
}