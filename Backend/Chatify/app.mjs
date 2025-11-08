import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import authRouter from './Routes/authRouter.mjs';
import userRouter from './Routes/userRouter.mjs'
import chatRouter from './Routes/chatRouter.mjs';
import messageRouter from './Routes/messageRouter.mjs';
import errHandler from './Controller/errController.mjs';
import protect from './Middlewares/protectRoutes.mjs';
import { CustomError } from './Utils/customError.mjs';
import sanitization from './Middlewares/sanitization.mjs';
import passport from 'passport';
import './Config/passport.mjs'; // Import passport configuration
import {googleAuth,
  googleCallback,
  githubAuth,
  githubCallback,
  discordAuth,
  discordCallback
} from "./Controller/authController.mjs";
const app = express();

app.use(helmet());

app.disable('x-powered-by');

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

const isProd = process.env.NODE_ENV === 'production';

const FRONTEND_ORIGIN = isProd
  ? process.env.FRONTEND_ORIGIN
  : 'http://localhost:5173';

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

// Google  routes
app.get("/api/auth/google", googleAuth);
app.get("/api/auth/google/callback", googleCallback);

// GitHub routes
app.get("/api/auth/github", githubAuth);
app.get("/api/auth/github/callback", githubCallback);

// Discord routes
app.get("/api/auth/discord", discordAuth);
app.get("/api/auth/discord/callback", discordCallback);



export const csrfProtection = csurf({
  cookie: {
    httpOnly: false,
    sameSite: 'none',
    secure: isProd,
  },
});

app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.cookie('XSRF-TOKEN', req.csrfToken(), {
    httpOnly: false,
    sameSite: 'none',
    secure: isProd,
  });
  res.status(204).end();
});

app.use((req, res, next) => {
  const exemptRoutes = ['/api/auth/logout', '/api/auth/refresh-token'];
  if (exemptRoutes.includes(req.path)) {
    return next();
  }
  csrfProtection(req, res, next);
});

app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/chat', protect, chatRouter);
app.use('/api/message', protect, messageRouter);

app.use((req, res, next) => {
  const error = new CustomError(`Can't find ${req.originalUrl} on this server`, 404);
  next(error);
});

app.use(errHandler);
export default app;