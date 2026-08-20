# External Integrations

**Analysis Date:** 2026-06-07

## APIs & External Services

**Email Delivery:**
- Brevo SMTP Email API - Sends password reset codes through `https://api.brevo.com/v3/smtp/email`.
  - SDK/Client: `axios` in `Backend/Chatify/Services/emailService.mjs`.
  - Auth: `BREVO_API_KEY`.
  - Sender configuration: `EMAIL_USER_SENDER` with fallback `chatify-help@outlook.com` in `Backend/Chatify/Services/emailService.mjs`.

**OAuth Providers:**
- Google OAuth - Social login provider exposed through `/api/auth/google` and `/api/auth/google/callback`.
  - SDK/Client: `passport-google-oauth20` in `Backend/Chatify/Config/passport.mjs`.
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
  - Routes: `Backend/Chatify/app.mjs` and callback handler in `Backend/Chatify/Controller/authController.mjs`.
- GitHub OAuth - Social login provider exposed through `/api/auth/github` and `/api/auth/github/callback`.
  - SDK/Client: `passport-github2` in `Backend/Chatify/Config/passport.mjs`.
  - Auth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.
  - Routes: `Backend/Chatify/app.mjs` and callback handler in `Backend/Chatify/Controller/authController.mjs`.
- Discord OAuth - Social login provider exposed through `/api/auth/discord` and `/api/auth/discord/callback`.
  - SDK/Client: `passport-discord` in `Backend/Chatify/Config/passport.mjs`.
  - Auth: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`.
  - Scope: `identify`, `email` in `Backend/Chatify/Config/passport.mjs`.

**Backend API Consumption:**
- Chatify backend API - Frontend calls REST endpoints under `/api/*`.
  - SDK/Client: `axios` instance in `Frontend/Chatify/src/api/axios.ts`.
  - Base URL: `VITE_BACKEND_URL` with fallback `http://localhost:3000`.
  - Credentials: `withCredentials: true` in `Frontend/Chatify/src/api/axios.ts`.
  - API modules: `Frontend/Chatify/src/api/authApi.ts`, `Frontend/Chatify/src/api/userApi.ts`, `Frontend/Chatify/src/api/chatApi.ts`, `Frontend/Chatify/src/api/messageApi.ts`.

**Realtime Messaging:**
- Chatify Socket.IO backend - Frontend connects to realtime events for chat, typing, delivery, read status, reactions, deletion, presence, and unread counts.
  - SDK/Client: `socket.io` in `Backend/Chatify/Config/socket.mjs`; `socket.io-client` in `Frontend/Chatify/src/hooks/useChatSocket.ts`.
  - Auth/identity: frontend emits `user:connect` with the current user id in `Frontend/Chatify/src/hooks/useChatSocket.ts`.
  - URL: `VITE_SOCKET_URL` or `VITE_BACKEND_URL`, with fallback `http://localhost:3000`, in `Frontend/Chatify/src/hooks/useChatSocket.ts`.
  - CORS origin: `FRONTEND_ORIGIN` or `FRONTEND_ORIGIN_DEV` in `Backend/Chatify/Config/socket.mjs`.

## Data Storage

**Databases:**
- MongoDB
  - Connection: `MONGODB_URL` in `Backend/Chatify/Config/DBConfig.mjs`.
  - Client: `mongoose` in `Backend/Chatify/Config/DBConfig.mjs`.
  - Models: `Backend/Chatify/Models/userModel.mjs`, `Backend/Chatify/Models/chatModel.mjs`, `Backend/Chatify/Models/messageModel.mjs`, `Backend/Chatify/Models/passwordResetModel.mjs`.

**File Storage:**
- Local/static assets only detected.
  - Frontend assets are under `Frontend/Chatify/src/assets`.
  - No S3, Cloudinary, Firebase Storage, or equivalent file storage SDK detected in `Backend/Chatify/package.json` or `Frontend/Chatify/package.json`.

**Caching:**
- No external cache detected.
  - Frontend uses in-memory React Query cache via `@tanstack/react-query` in `Frontend/Chatify/src/hooks/useChatQueries.ts`.
  - Backend uses in-memory request queues and Socket.IO presence maps in `Backend/Chatify/Middlewares/queueMiddleware.mjs`, `Backend/Chatify/Utils/requestQueue.mjs`, and `Backend/Chatify/Config/socket.mjs`.

## Authentication & Identity

**Auth Provider:**
- Custom JWT cookie authentication plus Passport OAuth.
  - JWT implementation: `jsonwebtoken` signs access tokens into an `accessToken` cookie in `Backend/Chatify/Utils/tokenCookieGenerator.mjs`.
  - Protected routes: `Backend/Chatify/Middlewares/protectRoutes.mjs` accepts the `accessToken` cookie or a Bearer token.
  - Auth routes: `Backend/Chatify/Routes/authRouter.mjs` exposes signup, login, logout, refresh-token, is-authenticated, forgot-password, verify-reset-code, and reset-password.
  - OAuth implementation: `Backend/Chatify/Config/passport.mjs` creates or links users, storing provider ids in `Backend/Chatify/Models/userModel.mjs`.
  - Frontend auth state: `Frontend/Chatify/src/store/authstore.ts` and auth API wrappers in `Frontend/Chatify/src/api/authApi.ts`.

**Session/Cookie Behavior:**
- Access token cookie name: `accessToken` in `Backend/Chatify/Utils/tokenCookieGenerator.mjs`.
- Cookie flags: `httpOnly: true`; `secure` depends on `NODE_ENV`; `sameSite` is `none` in production and `lax` in development in `Backend/Chatify/Utils/tokenCookieGenerator.mjs`.
- Refresh flow: `Frontend/Chatify/src/api/axios.ts` retries `401` responses once after posting to `/api/auth/refresh-token`; backend route exists in `Backend/Chatify/Routes/authRouter.mjs`.

**CSRF:**
- CSRF token endpoint exists at `/api/csrf-token` in `Backend/Chatify/app.mjs`.
- Full route-level CSRF middleware is commented out in `Backend/Chatify/app.mjs`.
- Frontend has `fetchCSRFToken` in `Frontend/Chatify/src/api/authApi.ts`.

## Monitoring & Observability

**Error Tracking:**
- None detected.
  - No Sentry, Datadog, New Relic, OpenTelemetry, or equivalent dependency detected in `Backend/Chatify/package.json` or `Frontend/Chatify/package.json`.

**Logs:**
- Console logging and request logging.
  - Backend development request logger is mounted in `Backend/Chatify/app.mjs` from `Backend/Chatify/Middlewares/requestLogger.mjs`.
  - Database connection logs are in `Backend/Chatify/Config/DBConfig.mjs`.
  - Socket debug logs are gated by `NODE_ENV` in `Backend/Chatify/Config/socket.mjs`.
  - Auth middleware logs token/cookie state in `Backend/Chatify/Middlewares/protectRoutes.mjs`.
  - Email errors are logged in `Backend/Chatify/Services/emailService.mjs`.

## CI/CD & Deployment

**Hosting:**
- Frontend: Vercel is indicated by `Frontend/Chatify/vercel.json`.
- Backend: Render is indicated by hard-coded production URL `https://chatify-ckmn.onrender.com` in `Backend/Chatify/Config/passport.mjs` and Vite proxy target in `Frontend/Chatify/vite.config.ts`.
- Database: MongoDB provider is configured only through `MONGODB_URL`; specific provider is not detected from source files.

**CI Pipeline:**
- None detected.
  - No workflow files found under `.github/workflows`.
  - No `render.yaml`, Dockerfile, or docker-compose configuration detected.

## Environment Configuration

**Required env vars:**
- Backend:
  - `NODE_ENV` - production/development behavior in `Backend/Chatify/app.mjs`, `Backend/Chatify/Config/passport.mjs`, `Backend/Chatify/Config/socket.mjs`, `Backend/Chatify/Utils/tokenCookieGenerator.mjs`.
  - `PORT` or `PORT_NUMBER` - backend HTTP server port in `Backend/Chatify/server.mjs`.
  - `MONGODB_URL` - MongoDB connection string in `Backend/Chatify/Config/DBConfig.mjs`.
  - `SECRET_JWT_KEY` - JWT signing and verification in `Backend/Chatify/Utils/tokenCookieGenerator.mjs`, `Backend/Chatify/Middlewares/protectRoutes.mjs`, `Backend/Chatify/Controller/authController.mjs`.
  - `EXPIRES_IN` - default JWT lifetime in `Backend/Chatify/Utils/tokenCookieGenerator.mjs` and `Backend/Chatify/Middlewares/protectRoutes.mjs`.
  - `FRONTEND_ORIGIN` - production CORS, Socket.IO CORS, and OAuth redirect base in `Backend/Chatify/app.mjs`, `Backend/Chatify/Config/socket.mjs`, `Backend/Chatify/Controller/authController.mjs`.
  - `FRONTEND_ORIGIN_DEV` - development CORS and Socket.IO fallback in `Backend/Chatify/app.mjs` and `Backend/Chatify/Config/socket.mjs`.
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth in `Backend/Chatify/Config/passport.mjs`.
  - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` - GitHub OAuth in `Backend/Chatify/Config/passport.mjs`.
  - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` - Discord OAuth in `Backend/Chatify/Config/passport.mjs`.
  - `EMAIL_USER_SENDER` - Brevo sender email in `Backend/Chatify/Services/emailService.mjs`.
  - `BREVO_API_KEY` - Brevo API authentication in `Backend/Chatify/Services/emailService.mjs`.
- Frontend:
  - `VITE_BACKEND_URL` - Axios base URL and OAuth redirect target in `Frontend/Chatify/src/api/axios.ts` and `Frontend/Chatify/src/pages/login/login.tsx`.
  - `VITE_SOCKET_URL` - Optional Socket.IO URL override in `Frontend/Chatify/src/hooks/useChatSocket.ts`.

**Secrets location:**
- `Backend/Chatify/.env` file present - contains backend environment configuration and must not be read or quoted.
- `Frontend/Chatify/.env` file present - contains frontend environment configuration and must not be read or quoted.

## Webhooks & Callbacks

**Incoming:**
- OAuth callback routes:
  - `GET /api/auth/google/callback` in `Backend/Chatify/app.mjs`, handled by `googleCallback` in `Backend/Chatify/Controller/authController.mjs`.
  - `GET /api/auth/github/callback` in `Backend/Chatify/app.mjs`, handled by `githubCallback` in `Backend/Chatify/Controller/authController.mjs`.
  - `GET /api/auth/discord/callback` in `Backend/Chatify/app.mjs`, handled by `discordCallback` in `Backend/Chatify/Controller/authController.mjs`.
- Socket.IO incoming events:
  - `user:connect`, `chat:join`, `chat:leave`, `message:send`, `message:delivered`, `typing:start`, `typing:stop`, `disconnect` in `Backend/Chatify/Config/socket.mjs`.
- No third-party webhook receiver endpoints detected.

**Outgoing:**
- Brevo email API call to `https://api.brevo.com/v3/smtp/email` in `Backend/Chatify/Services/emailService.mjs`.
- OAuth redirects from frontend login buttons to `/api/auth/google`, `/api/auth/github`, and `/api/auth/discord` in `Frontend/Chatify/src/pages/login/login.tsx`.
- OAuth redirects from backend callbacks back to the frontend in `Backend/Chatify/Controller/authController.mjs`.
- Socket.IO outgoing events include `user:connected`, `user:status-change`, `chat:new`, `chat:deleted`, `message:new`, `message:status-update`, `message:read`, `messages:read-batch`, `message:deleted`, `message:edited`, `message:reaction`, `unread:update`, and `user:typing` across `Backend/Chatify/Config/socket.mjs` and frontend listeners in `Frontend/Chatify/src/hooks/useChatSocket.ts`.

---

*Integration audit: 2026-06-07*
