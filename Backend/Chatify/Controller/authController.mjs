import User from '../Models/userModel.mjs';
import Session from '../Models/sessionModel.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import {CustomError} from '../Utils/customError.mjs';
import jsonwebtoken from 'jsonwebtoken'
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import {
  clearSessionCookies,
  issueSessionCookies,
  readRefreshTokenFromRequest,
  revokeRefreshSession,
  revokeRefreshSessionsForUser,
  rotateSessionCookies,
} from '../Utils/tokenCookieGenerator.mjs'
import { readAccessTokenFromRequest, verifyAccessToken } from '../Utils/authToken.mjs';
import passport from 'passport';
import PasswordReset from '../Models/passwordResetModel.mjs';
import OAuthHandoff from '../Models/oauthHandoffModel.mjs';
import {sendPasswordResetEmail} from '../Services/emailService.mjs';
import { resolveOAuthFinalizeBaseURL } from '../Utils/oauthConfig.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';
import {
  buildUsernameConflict,
  validateUsername,
} from '../Utils/usernameValidation.mjs';
import {
  assertActiveSessionClaim,
  findActiveSession,
  serializeSessionForUser,
} from '../Utils/sessionMetadata.mjs';

const isProd = process.env.NODE_ENV === 'production';
const FRONTEND_URL = isProd 
  ? process.env.FRONTEND_ORIGIN || 'https://chatify-ten-rho.vercel.app'
  : 'http://localhost:5173';
const OAUTH_STATE_COOKIE = 'chatify_oauth_state';
const OAUTH_HANDOFF_PURPOSE = 'oauth_handoff';
const OAUTH_HANDOFF_TOKEN_TYPE = 'oauth_handoff';
const OAUTH_HANDOFF_EXPIRES_IN = '60s';
const OAUTH_HANDOFF_TTL_MS = 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const LOGIN_FAILURE_MESSAGE = 'Email or password is incorrect';

const hashOAuthState = (state) => createHash('sha256').update(state).digest('base64url');

const getOAuthStateCookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: 5 * 60 * 1000,
  path: '/api/auth',
});

const getClearOAuthStateCookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/api/auth',
});

const clearOAuthStateCookie = (res) => {
  res.clearCookie(OAUTH_STATE_COOKIE, getClearOAuthStateCookieOptions());
};

const buildFrontendUrl = (pathname, params = {}) => {
  const url = new URL(pathname, FRONTEND_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
};

const buildOAuthFinalizeUrl = (handoffToken) => {
  const url = new URL('/api/auth/oauth/finalize', resolveOAuthFinalizeBaseURL());
  url.searchParams.set('token', handoffToken);
  return url.toString();
};

const generateOAuthState = () => randomBytes(32).toString('base64url');

const generateOAuthHandoffToken = ({ user, jti, stateHash }) => jsonwebtoken.sign(
  {
    userId: user._id,
    type: OAUTH_HANDOFF_TOKEN_TYPE,
    purpose: OAUTH_HANDOFF_PURPOSE,
    jti,
    stateHash,
  },
  process.env.SECRET_JWT_KEY,
  { expiresIn: OAUTH_HANDOFF_EXPIRES_IN }
);

const redirectOAuthFailure = (res) => {
  clearOAuthStateCookie(res);
  return res.redirect(buildFrontendUrl('/login', { error: 'auth_failed' }));
};

export const signup =asyncErrHandler( async (req, res, next) => {
  let { firstName, lastName, email, password, username } = req.body;

  if (!firstName || !lastName || !email || !password || !username) {
    return next(new CustomError('Please provide all the required fields', 400));
  }

  const usernameValidation = validateUsername(username);
  if (!usernameValidation.ok) {
    return res.status(400).json({
      status: 'fail',
      code: usernameValidation.code,
      message: usernameValidation.message,
    });
  }

  const exUser = await User.findOne({email:email})
  if (exUser) {
    return next(new CustomError('User already exists with this email', 400));
  }

  const usernameExists = await User.exists({ username: usernameValidation.value });
  if (usernameExists) {
    const conflict = buildUsernameConflict();
    return res.status(409).json({
      status: 'fail',
      code: conflict.code,
      message: conflict.message,
    });
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    username: usernameValidation.value,
    password,
    profilePic: '',
    authProvider: 'local',
  })

  await issueSessionCookies({ user, res, rememberMe: false, req });
  return res.status(201).json({
    success: true,
    message: 'User created successfully',
    user: user.toJSON(),
  });
}
)

export const login = asyncErrHandler(async (req, res, next) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password) {
    return next(new CustomError('Please provide email and password', 400));
  }
  const user = await User.findOne({email:email}).select("+password +authProvider")
  if (!user) return next(new CustomError(LOGIN_FAILURE_MESSAGE, 401))
  
  // Check if user signed up via OAuth (no password set)
  if (user.authProvider && user.authProvider !== 'local') {
    return next(new CustomError(LOGIN_FAILURE_MESSAGE, 401));
  }
  
  const credentials = await user.checkPassword(password)
  if (!credentials) {
    return next(new CustomError(LOGIN_FAILURE_MESSAGE, 401))
  }

  await issueSessionCookies({ user, res, rememberMe, req });

  return res.status(200).json({
    status:"success",
    message:"Logged in successfully!",
  })
})

export const logout = asyncErrHandler(async (req, res, next) => {
  await revokeRefreshSession(readRefreshTokenFromRequest(req));
  clearSessionCookies(res);
  
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
})

export const refreshToken = asyncErrHandler(async (req, res, next) => {
  await rotateSessionCookies({
    refreshToken: readRefreshTokenFromRequest(req),
    res,
    req,
  });

  return res.status(200).json({ status: 'success', message: 'Token refreshed successfully' });
});

export const isAuthenticated = asyncErrHandler(async (req, res, next) => {
  const token = readAccessTokenFromRequest(req);
  let isValid = false;

  if (token) {
    try {
      const { decoded, userId } = verifyAccessToken(token);
      await assertActiveSessionClaim({
        sessionId: decoded.sessionId?.toString?.() ?? null,
        userId,
      });
      isValid = true;
    } catch {
      isValid = false;
    }
  }

  res.status(200).json({
    status:"success",
    message:"User is authenticated",
    token: isValid
  })
})

export const listActiveSessions = asyncErrHandler(async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({
      status: 'fail',
      message: 'Authentication required',
    });
  }

  const now = new Date();
  const sessions = await Session.find({
    userId: req.userId,
    revokedAt: null,
    expiresAt: { $gt: now },
  })
    .sort({ lastUsedAt: -1, createdAt: -1 })
    .limit(50);

  return res.status(200).json({
    status: 'success',
    data: {
      sessions: sessions.map((session) => serializeSessionForUser(session, req.sessionId)),
    },
  });
});

export const revokeSession = asyncErrHandler(async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({
      status: 'fail',
      message: 'Authentication required',
    });
  }

  if (req.params.sessionId === req.sessionId) {
    return res.status(400).json({
      status: 'fail',
      message: 'Use logout to end the current session',
    });
  }

  const session = await findActiveSession({
    sessionId: req.params.sessionId,
    userId: req.userId,
  });

  if (!session) {
    return res.status(404).json({
      status: 'fail',
      message: 'Session not found',
    });
  }

  session.revokedAt = new Date();
  session.lastUsedAt = new Date();
  await session.save();

  return res.status(200).json({
    status: 'success',
    data: {
      session: serializeSessionForUser(session, req.sessionId),
    },
  });
});

export const revokeAllSessions = asyncErrHandler(async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({
      status: 'fail',
      message: 'Authentication required',
    });
  }

  const now = new Date();
  const result = await Session.updateMany(
    {
      userId: req.userId,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        revokedAt: now,
        lastUsedAt: now,
      },
    }
  );

  clearSessionCookies(res);

  return res.status(200).json({
    status: 'success',
    data: {
      revokedCount: result.modifiedCount ?? 0,
    },
  });
});

// Helper function for OAuth callbacks
const createOAuthCallback = (provider) => {
  return (req, res, next) => {
    passport.authenticate(provider, { session: false }, async (err, user) => {
      
      if (err) {
        return res.redirect(buildFrontendUrl('/login', { error: 'oauth_failed' }));
      }

      if (!user) {
        return res.redirect(buildFrontendUrl('/login', { error: 'oauth_no_user' }));
      }

      try {
        const state = typeof req.query.state === 'string' ? req.query.state : '';

        if (!state) {
          return res.redirect(buildFrontendUrl('/login', { error: 'auth_failed' }));
        }

        const stateHash = hashOAuthState(state);
        const jti = randomUUID();

        await OAuthHandoff.create({
          jti,
          userId: user._id,
          stateHash,
          expiresAt: new Date(Date.now() + OAUTH_HANDOFF_TTL_MS),
        });

        const handoffToken = generateOAuthHandoffToken({ user, jti, stateHash });

        return res.redirect(buildOAuthFinalizeUrl(handoffToken));
      } catch {
        return res.redirect(buildFrontendUrl('/login', { error: 'auth_failed' }));
      }
    })(req, res, next);
  };
};

export const finalizeOAuth = asyncErrHandler(async (req, res) => {
  const { token } = req.query;
  const stateCookie = req.cookies[OAUTH_STATE_COOKIE];

  if (typeof token !== 'string' || !token) {
    return redirectOAuthFailure(res);
  }

  if (typeof stateCookie !== 'string' || !stateCookie) {
    return redirectOAuthFailure(res);
  }

  try {
    const decoded = jsonwebtoken.verify(token, process.env.SECRET_JWT_KEY);

    if (
      decoded?.type !== OAUTH_HANDOFF_TOKEN_TYPE ||
      decoded?.purpose !== OAUTH_HANDOFF_PURPOSE ||
      !decoded.userId ||
      typeof decoded.jti !== 'string' ||
      typeof decoded.stateHash !== 'string' ||
      decoded.stateHash !== hashOAuthState(stateCookie)
    ) {
      return redirectOAuthFailure(res);
    }

    const handoff = await OAuthHandoff.findOneAndUpdate(
      {
        jti: decoded.jti,
        userId: decoded.userId,
        stateHash: decoded.stateHash,
        consumedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { consumedAt: new Date() } },
      { new: true }
    );

    if (!handoff) {
      return redirectOAuthFailure(res);
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      return redirectOAuthFailure(res);
    }

    await issueSessionCookies({ user, res, rememberMe: false, req });
    clearOAuthStateCookie(res);

    return res.redirect(buildFrontendUrl('/', { auth: 'success' }));
  } catch {
    return redirectOAuthFailure(res);
  }
});

// OAuth authentication initiators
const createOAuthInitiator = (provider, options) => {
  return (req, res, next) => {
    const state = generateOAuthState();

    res.cookie(OAUTH_STATE_COOKIE, state, getOAuthStateCookieOptions());
    return passport.authenticate(provider, {
      ...options,
      state,
    })(req, res, next);
  };
};

export const googleAuth = createOAuthInitiator('google', {
  scope: ['profile', 'email'],
});

export const githubAuth = createOAuthInitiator('github', {
  scope: ['user:email'],
});

export const discordAuth = createOAuthInitiator('discord', {
  scope: ['identify', 'email'],
});

// OAuth callbacks
export const googleCallback = createOAuthCallback('google');
export const githubCallback = createOAuthCallback('github');
export const discordCallback = createOAuthCallback('discord');

const generateResetCode = () => {
  return randomInt(100000, 1000000).toString();
}

const getPasswordResetSecret = () => {
  const secret = process.env.PASSWORD_RESET_SECRET;

  if (!secret) {
    throw new CustomError('Password reset is temporarily unavailable', 500);
  }

  return secret;
};

const hashPasswordResetCode = (code) => createHmac('sha256', getPasswordResetSecret())
  .update(String(code))
  .digest('base64url');

const safeHashEqual = (left, right) => {
  const leftBuffer = Buffer.from(left ?? '');
  const rightBuffer = Buffer.from(right ?? '');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const recordFailedResetAttempt = async (resetToken) => {
  const nextAttempts = (resetToken.attempts ?? 0) + 1;

  if (nextAttempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
    await PasswordReset.deleteOne({ _id: resetToken._id });
    return;
  }

  resetToken.attempts = nextAttempts;
  await resetToken.save();
};

const findValidPasswordReset = async ({ email, code }) => {
  const resetToken = await PasswordReset
    .findOne({ email, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 });

  if (!resetToken) {
    return null;
  }

  const codeHash = hashPasswordResetCode(code);
  if (!safeHashEqual(resetToken.tokenHash, codeHash)) {
    await recordFailedResetAttempt(resetToken);
    return null;
  }

  return resetToken;
};

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
      tokenHash: hashPasswordResetCode(resetCode),
      attempts: 0,
    })
    
    try {
      await sendPasswordResetEmail(user.email, resetCode);
    } catch (err) {
      logger.error('auth.password_reset_notification_failed', {
        userId: user._id.toString(),
        code: err?.code,
        status: err?.response?.status,
        error: err,
      });
      
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
    const resetToken = await findValidPasswordReset({ email, code });
    
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
    
    const resetToken = await findValidPasswordReset({ email, code });
    
    if (!resetToken) {
      return next(new CustomError('Invalid or expired reset code', 400));
    }

    const user = await User.findById(resetToken.userId);
    if (!user) {
      return next(new CustomError('User not found', 404));
    }

    user.password = newPassword;
    await user.save();
    await revokeRefreshSessionsForUser(user._id);
    await PasswordReset.deleteOne({ _id: resetToken._id});
    clearSessionCookies(res);

    return res.status(200).json({
      status: 'success',
      message: 'Password reset successfully'
    })
  })
