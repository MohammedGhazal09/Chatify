import User from '../Models/userModel.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import {CustomError} from '../Utils/customError.mjs';
import jsonwebtoken from 'jsonwebtoken'
import { generateTokenAndSetCookie } from '../Utils/tokenCookieGenerator.mjs'
import passport from 'passport';

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
  })
})

// Helper function for OAuth callbacks
const createOAuthCallback = (provider) => {
  return asyncErrHandler(async (req, res, next) => {
    passport.authenticate(provider, { session: false }, (err, user, info) => {
      const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
      
      if (err) {
        console.error(`${provider} OAuth error:`, err);
        return res.redirect(`${frontendOrigin}/login?error=oauth_error`);
      }
      
      if (!user) {
        return res.redirect(`${frontendOrigin}/login?error=oauth_failed`);
      }
      
      // Generate JWT token
      generateTokenAndSetCookie(user, res, true);
      
      // Redirect to frontend
      return res.redirect(`${frontendOrigin}/?auth=success`);
    })(req, res, next);
  });
};

// OAuth authentication initiators
export const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email']
});

export const githubAuth = passport.authenticate('github', {
  scope: ['user:email']
});

export const linkedinAuth = passport.authenticate('linkedin', {
  scope: ['r_emailaddress', 'r_liteprofile']
});

// OAuth callbacks
export const googleCallback = createOAuthCallback('google');
export const githubCallback = createOAuthCallback('github');
export const linkedinCallback = createOAuthCallback('linkedin');