# Technology Stack

**Analysis Date:** 2026-06-07

## Languages

**Primary:**
- JavaScript ES modules - Backend Express application in `Backend/Chatify/server.mjs`, `Backend/Chatify/app.mjs`, `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Config/socket.mjs`.
- TypeScript with TSX - Frontend React application in `Frontend/Chatify/src/main.tsx`, `Frontend/Chatify/src/App.tsx`, `Frontend/Chatify/src/pages/chat/chat.tsx`, `Frontend/Chatify/src/api/axios.ts`.

**Secondary:**
- JSON - Package manifests and TypeScript/Vercel configuration in `package.json`, `Backend/Chatify/package.json`, `Frontend/Chatify/package.json`, `Frontend/Chatify/tsconfig.json`, `Frontend/Chatify/vercel.json`.
- CSS via Tailwind CSS - Frontend styling framework configured through `Frontend/Chatify/vite.config.ts` and dependency declarations in `Frontend/Chatify/package.json`.

## Runtime

**Environment:**
- Node.js - Required for both backend (`Backend/Chatify/package.json`) and frontend build tooling (`Frontend/Chatify/package.json`).
- Browser runtime - React SPA served from the Vite build in `Frontend/Chatify/src/main.tsx`.

**Package Manager:**
- npm - Lockfiles are present at `Backend/Chatify/package-lock.json` and `Frontend/Chatify/package-lock.json`.
- Lockfile: present for backend and frontend; missing for the root `package.json`.

## Frameworks

**Core:**
- Express `^5.1.0` - Backend HTTP API in `Backend/Chatify/app.mjs`.
- React `^19.1.0` and React DOM `^19.1.0` - Frontend UI in `Frontend/Chatify/src/main.tsx` and `Frontend/Chatify/src/App.tsx`.
- Vite `^7.0.4` - Frontend dev server and production build configured in `Frontend/Chatify/vite.config.ts`.
- Socket.IO `^4.8.1` - Backend realtime server in `Backend/Chatify/Config/socket.mjs`.
- Socket.IO Client `^4.8.1` - Frontend realtime client in `Frontend/Chatify/src/hooks/useChatSocket.ts`.
- Mongoose `^8.16.4` - MongoDB ODM used in `Backend/Chatify/Config/DBConfig.mjs`, `Backend/Chatify/Models/userModel.mjs`, `Backend/Chatify/Models/chatModel.mjs`, `Backend/Chatify/Models/messageModel.mjs`, `Backend/Chatify/Models/passwordResetModel.mjs`.

**Testing:**
- Not detected - Root and backend `test` scripts intentionally fail with "no test specified" in `package.json` and `Backend/Chatify/package.json`.
- Not detected - Frontend has lint/build scripts but no test framework dependency in `Frontend/Chatify/package.json`.

**Build/Dev:**
- TypeScript `~5.8.3` - Frontend typechecking through `tsc -b` in `Frontend/Chatify/package.json`.
- ESLint `^9.30.1` with `typescript-eslint` `^8.35.1` - Frontend linting configured in `Frontend/Chatify/eslint.config.js`.
- `@vitejs/plugin-react` `^4.6.0` - React Fast Refresh and Vite integration in `Frontend/Chatify/vite.config.ts`.
- Tailwind CSS `^4.1.11` and `@tailwindcss/vite` `^4.1.11` - Vite Tailwind plugin configured in `Frontend/Chatify/vite.config.ts`.
- nodemon `^3.1.10` - Backend development dependency in `Backend/Chatify/package.json`; no script currently wires it.

## Key Dependencies

**Critical:**
- `express` `^5.1.0` - Owns API routing, middleware, and error handling in `Backend/Chatify/app.mjs`.
- `mongoose` `^8.16.4` - Owns persistence models and MongoDB connection in `Backend/Chatify/Config/DBConfig.mjs`.
- `jsonwebtoken` `^9.0.2` - Issues and verifies access tokens in `Backend/Chatify/Utils/tokenCookieGenerator.mjs` and `Backend/Chatify/Middlewares/protectRoutes.mjs`.
- `argon2` `^0.43.1` - Password hashing dependency declared in `Backend/Chatify/package.json` and used by the auth domain.
- `passport` `^0.7.0` - OAuth strategy host initialized in `Backend/Chatify/app.mjs` and configured in `Backend/Chatify/Config/passport.mjs`.
- `passport-google-oauth20` `^2.0.0`, `passport-github2` `^0.1.12`, `passport-discord` `^0.1.4` - Social login strategies in `Backend/Chatify/Config/passport.mjs`.
- `socket.io` `^4.8.1` and `socket.io-client` `^4.8.1` - Realtime chat, typing, presence, and message status flow in `Backend/Chatify/Config/socket.mjs` and `Frontend/Chatify/src/hooks/useChatSocket.ts`.
- `axios` `^1.13.2` backend / `^1.11.0` frontend - Backend Brevo API call in `Backend/Chatify/Services/emailService.mjs`; frontend API client in `Frontend/Chatify/src/api/axios.ts`.
- `@tanstack/react-query` `^5.90.4` - Frontend query/cache management used by hooks such as `Frontend/Chatify/src/hooks/useChatQueries.ts` and `Frontend/Chatify/src/hooks/useChatSocket.ts`.
- `zustand` `^5.0.8` - Frontend auth and presence stores in `Frontend/Chatify/src/store/authstore.ts` and `Frontend/Chatify/src/store/presenceStore.ts`.
- `react-router-dom` `^7.7.1` - Frontend routing in `Frontend/Chatify/src/App.tsx`.
- `react-hook-form` `^7.62.0`, `@hookform/resolvers` `^5.2.1`, `zod` `^4.1.1` - Frontend form validation in `Frontend/Chatify/src/pages/login/login.tsx`, `Frontend/Chatify/src/pages/signup/signup.tsx`, and `Frontend/Chatify/src/utils/validationSchemas.tsx`.

**Infrastructure:**
- `dotenv` `^17.2.0` - Loads backend environment from `.env` via `import 'dotenv/config'` in `Backend/Chatify/server.mjs`.
- `cors` `^2.8.5` - Cross-origin cookies and API access configured in `Backend/Chatify/app.mjs`.
- `cookie-parser` `^1.4.7` - Cookie access for auth middleware in `Backend/Chatify/app.mjs`.
- `helmet` `^8.1.0` - HTTP header hardening in `Backend/Chatify/app.mjs`.
- `express-rate-limit` `^8.2.1` - Global, auth, session, refresh, and message rate limits in `Backend/Chatify/app.mjs` and `Backend/Chatify/Middlewares/rateLimiters.mjs`.
- `express-mongo-sanitize` `^2.2.0`, `hpp` `^0.2.3`, `xss` `^1.0.15`, `validator` `^13.15.15` - Input sanitization/security dependencies declared in `Backend/Chatify/package.json`; sanitization middleware is mounted in `Backend/Chatify/app.mjs`.
- `csurf` `^1.11.0` - CSRF token endpoint in `Backend/Chatify/app.mjs`; broad route-level CSRF enforcement is commented out.
- `nodemailer` `^7.0.9` and `@types/nodemailer` `^7.0.2` - Email-related dependency declared in `Backend/Chatify/package.json`; password reset currently sends through Brevo with Axios in `Backend/Chatify/Services/emailService.mjs`.

## Configuration

**Environment:**
- Backend environment variables are loaded from `Backend/Chatify/.env` through `Backend/Chatify/server.mjs`; the file is present and must not be committed or quoted.
- Frontend Vite environment variables are stored in `Frontend/Chatify/.env`; the file is present and must not be committed or quoted.
- Required backend vars referenced in code: `NODE_ENV`, `PORT`, `PORT_NUMBER`, `MONGODB_URL`, `SECRET_JWT_KEY`, `EXPIRES_IN`, `FRONTEND_ORIGIN`, `FRONTEND_ORIGIN_DEV`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `EMAIL_USER_SENDER`, `BREVO_API_KEY`.
- Required frontend vars referenced in code: `VITE_BACKEND_URL`, `VITE_SOCKET_URL`.
- Backend production OAuth callback base is hard-coded to `https://chatify-ckmn.onrender.com` in `Backend/Chatify/Config/passport.mjs`.
- Frontend production fallback URL is hard-coded to `https://chatify-ten-rho.vercel.app` in `Backend/Chatify/Controller/authController.mjs`.

**Build:**
- Frontend Vite config: `Frontend/Chatify/vite.config.ts` uses React and Tailwind plugins and proxies `/api` to `https://chatify-ckmn.onrender.com`.
- Frontend TypeScript root config: `Frontend/Chatify/tsconfig.json` references `Frontend/Chatify/tsconfig.app.json` and `Frontend/Chatify/tsconfig.node.json`.
- Frontend ESLint config: `Frontend/Chatify/eslint.config.js` enables JS recommended, TypeScript recommended, React Hooks, and React Refresh rules.
- Frontend Vercel config: `Frontend/Chatify/vercel.json` rewrites all routes to `/index.html` for SPA routing.
- Backend start script: `npm start` runs `node server.mjs` from `Backend/Chatify/package.json`.
- Frontend scripts: `npm run dev`, `npm run build`, `npm run lint`, and `npm run preview` are defined in `Frontend/Chatify/package.json`.

## Platform Requirements

**Development:**
- Use Node.js and npm in both `Backend/Chatify` and `Frontend/Chatify`.
- Start backend from `Backend/Chatify` with `npm start`; it listens on `PORT`, `PORT_NUMBER`, or `5000` from `Backend/Chatify/server.mjs`.
- Start frontend from `Frontend/Chatify` with `npm run dev`; Vite defaults to `http://localhost:5173`, matching backend CORS fallback in `Backend/Chatify/app.mjs` and Socket.IO fallback in `Backend/Chatify/Config/socket.mjs`.
- Configure local backend `.env` with MongoDB, JWT, OAuth, Brevo, and frontend origin values before running auth or email flows.
- Configure local frontend `.env` with `VITE_BACKEND_URL` and optionally `VITE_SOCKET_URL` before running against a non-default backend.

**Production:**
- Backend target appears to be Render at `https://chatify-ckmn.onrender.com`, referenced in `Backend/Chatify/Config/passport.mjs` and `Frontend/Chatify/vite.config.ts`.
- Frontend target appears to be Vercel, with SPA rewrite configuration in `Frontend/Chatify/vercel.json` and fallback frontend URL `https://chatify-ten-rho.vercel.app` referenced in `Backend/Chatify/Controller/authController.mjs`.
- MongoDB is required in production through `MONGODB_URL` in `Backend/Chatify/Config/DBConfig.mjs`.
- Cross-domain cookies require `NODE_ENV=production`, secure cookies, and `FRONTEND_ORIGIN` alignment in `Backend/Chatify/app.mjs`, `Backend/Chatify/Config/socket.mjs`, and `Backend/Chatify/Utils/tokenCookieGenerator.mjs`.

---

*Stack analysis: 2026-06-07*
