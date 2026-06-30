import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import authRouter from './Routes/authRouter.mjs';
import userRouter from './Routes/userRouter.mjs'
import chatRouter from './Routes/chatRouter.mjs';
import messageRouter from './Routes/messageRouter.mjs';
import moderationRouter from './Routes/moderationRouter.mjs';
import adminRouter from './Routes/adminRouter.mjs';
import spaceRouter from './Routes/spaceRouter.mjs';
import inviteLinkRouter from './Routes/inviteLinkRouter.mjs';
import errHandler from './Controller/errController.mjs';
import protect from './Middlewares/protectRoutes.mjs';
import { CustomError } from './Utils/customError.mjs';
import sanitization from './Middlewares/sanitization.mjs';
import { requestLogger, errorRequestLogger } from './Middlewares/requestLogger.mjs';
import { queueStatus, queueHeavyRequests, addQueueHeaders } from './Middlewares/queueMiddleware.mjs';
import csrfProtection, { createCsrfToken, getCsrfCookieOptions } from './Middlewares/csrfProtection.mjs';
import passport from 'passport';
import './Config/passport.mjs'; // Import passport configuration
import { buildHealthPayload, buildReadinessPayload, getReadinessHttpStatus } from './Utils/operationalReadiness.mjs';
import {googleAuth,
  googleCallback,
  githubAuth,
  githubCallback,
  discordAuth,
  discordCallback
} from "./Controller/authController.mjs";
const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(requestLogger);

app.use(helmet());

app.disable('x-powered-by');

// Rate limiting for security
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per window
  skip: () => process.env.NODE_ENV === 'test',
  message: { status: 'error', message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});



const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 messages per minute
  skip: () => process.env.NODE_ENV === 'test',
  message: { status: 'error', message: 'Sending messages too fast, slow down!' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

const isProd = process.env.NODE_ENV === 'production';

const FRONTEND_ORIGIN = isProd
  ? process.env.FRONTEND_ORIGIN
  : process.env.FRONTEND_ORIGIN_DEV || 'http://localhost:5173';

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);

app.use(cookieParser());

app.use(hpp());


app.use(sanitization);

app.use(passport.initialize());

app.get('/api/health', (req, res) => {
  res.status(200).json(buildHealthPayload());
});

app.get('/api/ready', (req, res) => {
  const payload = buildReadinessPayload();
  res.status(getReadinessHttpStatus(payload)).json(payload);
});

// Queue status endpoint (for monitoring)
app.get('/api/queue-status', queueStatus);

// Apply queue middleware for heavy requests
app.use(queueHeavyRequests);
app.use(addQueueHeaders);

// Google  routes
app.get("/api/auth/google", googleAuth);
app.get("/api/auth/google/callback", googleCallback);

// GitHub routes
app.get("/api/auth/github", githubAuth);
app.get("/api/auth/github/callback", githubCallback);

// Discord routes
app.get("/api/auth/discord", discordAuth);
app.get("/api/auth/discord/callback", discordCallback);

app.get('/api/csrf-token', (req, res) => {
  const token = createCsrfToken();
  res.cookie('XSRF-TOKEN', token, getCsrfCookieOptions());
  res.status(204).end();
});

app.use('/api/auth', csrfProtection, authRouter);
app.use('/api/user', userRouter);
app.use('/api/chat', protect, csrfProtection, chatRouter);
app.use('/api/message', protect, csrfProtection, messageLimiter, messageRouter);
app.use('/api/moderation', protect, csrfProtection, moderationRouter);
app.use('/api/admin', protect, csrfProtection, adminRouter);
app.use('/api/space', protect, csrfProtection, spaceRouter);
app.use('/api/invite', protect, csrfProtection, inviteLinkRouter);

app.use((req, res, next) => {
  const error = new CustomError(`Can't find ${req.originalUrl} on this server`, 404);
  next(error);
});

app.use(errorRequestLogger);
app.use(errHandler);
export default app;
