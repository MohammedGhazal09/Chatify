import User from '../Models/userModel.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import {CustomError} from '../Utils/customError.mjs';
import jsonwebtoken from 'jsonwebtoken'
import { generateTokenAndSetCookie } from '../Utils/tokenCookieGenerator.mjs'
import passport from 'passport';
import PasswordReset from '../Models/passwordResetModel.mjs';
import {sendPasswordResetEmail} from '../Services/emailService.mjs';

const isProd = process.env.NODE_ENV === 'production';
const FRONTEND_URL = isProd 
  ? 'https://chatify-ten-rho.vercel.app'
  : 'http://localhost:5173';

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
  const user = await User.findOne({email:email}).select("+password")
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
    sameSite: 'none',
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
      if (err) {
        console.error(`${provider} OAuth error:`, err);
        return res.redirect(`${FRONTEND_URL}/login?error=oauth_error`);
      }
      
      if (!user) {
        console.error(`${provider} OAuth failed: No user returned`);
        return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
      }

      try {
        // Generate JWT token
        generateTokenAndSetCookie(user, res, true);
        
        // Redirect to frontend with success
        return res.redirect(`${FRONTEND_URL}/?auth=success`);
      } catch (error) {
        console.error('Token generation error:', error);
        return res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
      }
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

export const discordAuth = passport.authenticate('discord', {
  scope: ['identify', 'email']
});

// OAuth callbacks
export const googleCallback = createOAuthCallback('google');
export const githubCallback = createOAuthCallback('github');
export const discordCallback = createOAuthCallback('discord');

const generateResetCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
}

export const forgotPassword = asyncErrHandler(async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return next(new CustomError('Please provide your email', 400));
  }
  const user = await User.findOne({ email })
  
  if (!user) {
    return res.status(200).json({
      status: 'success',
      message: 'If an account with that email exists, a reset code has been sent'
    })}

    await PasswordReset.deleteMany({ userId: user._id});

    const resetCode = generateResetCode();

    await PasswordReset.create({
      userId: user._id,
      email: user.email,
      token: resetCode,
    })
    
    try {
      await sendPasswordResetEmail(user.email, resetCode);
    } catch (err) {
      console.log(err);
      
      return next(new CustomError('Failed to send reset email. Please try again.', 500));
    }

    return res.status(200).json({
      status: 'success',
      message: 'If an account with that email exists, a reset code has been sent'
    })
  })

  export const verifyResetCode = asyncErrHandler(async (req, res, next) => {
    const { email, code} = req.body;
    if (!email || !code) {
      return next(new CustomError('Please provide email and reset code', 400));
    }
    const resetToken = await PasswordReset.findOne({email, token: code, expiresAt: { $gt: new Date()}})
    
    if (!resetToken) {
      return next(new CustomError('Invalid or expired reset code', 400));
    }

    return res.status(200).json({
      status: 'success',
      message: 'Code verified successfully'
    })
  })

  export const resetPassword = asyncErrHandler(async (req, res, next) => {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return next(new CustomError('Please provide email, reset code and new password', 400));
    }
    
    const resetToken = await PasswordReset.findOne({email, token: code, expiresAt: { $gt: new Date()}})
    
    if (!resetToken) {
      return next(new CustomError('Invalid or expired reset code', 400));
    }

    const user = await User.findById(resetToken.userId);
    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    user.password = newPassword;
    await user.save();
    await PasswordReset.deleteOne({ _id: resetToken._id});

    return res.status(200).json({
      status: 'success',
      message: 'Password reset successfully'
    })
  })
