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
  linkedinAuth,
  linkedinCallback
} from "./Controller/authController.mjs";
const app = express();

app.use(helmet());

app.disable('x-powered-by');

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
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

// LinkedIn routes
app.get("/api/auth/linkedin", linkedinAuth);
app.get("/api/auth/linkedin/callback", linkedinCallback);



const isProd = process.env.NODE_ENV === 'production';
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
  },
});

app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.cookie('XSRF-TOKEN', req.csrfToken(), {
    httpOnly: false,
    sameSite: 'lax',
    secure: isProd,
  });
  res.status(204).end();
});

app.use('/api/auth',csrfProtection, authRouter);
app.use('/api/user', userRouter);
app.use('/api/chat', protect, chatRouter);
app.use('/api/message', protect, messageRouter);

app.use((req, res, next) => {
  const error = new CustomError(`Can't find ${req.originalUrl} on this server`, 404);
  next(error);
});

app.use(errHandler);
export default app;