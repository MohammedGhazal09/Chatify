<!-- GSD:project-start source:PROJECT.md -->

## Project

**Chatify**

Chatify is a brownfield MERN real-time messaging app with React, Express, MongoDB, and Socket.IO. The existing product has account flows, private chat, presence, message status, and social login scaffolding, but the core chat experience needs to be rebuilt into a reliable, secure, polished messenger.

The current milestone is a reconstruction effort: stabilize message sending and receiving, redesign the chat UI, add a professional messenger baseline, and make security review a blocking part of the work.

**Core Value:** Users can trust Chatify to deliver private real-time conversations reliably, securely, and clearly.

### Collaboration Preference

Always include recommendations when asking questions, writing specifications, or presenting options. Do not give bare questions without a suggested default and rationale.

### Constraints

- **Tech stack**: Keep the existing React/Vite frontend, Express backend, MongoDB/Mongoose persistence, Socket.IO realtime layer, TanStack Query, Zustand, Tailwind, and npm package layout unless a phase proves a focused replacement is necessary.
- **Brownfield safety**: Preserve existing behavior until replacement paths are tested and verified; avoid broad rewrites without a phase boundary.
- **Security**: Cookie-authenticated requests, socket identity, message privacy, reset flows, and logs are security-sensitive and require tests or explicit verification evidence.
- **Delivery model**: Use GSD phases with standard granularity, parallel execution where plans are independent, and committed planning docs.
- **Repository hygiene**: Existing local work in `Frontend/Chatify/src/pages/chat/chat.tsx` must not be overwritten unless the user explicitly authorizes it.
- **Deployment**: Production references currently point to Render for backend and Vercel for frontend; CORS, cookies, and socket credentials must stay aligned.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- JavaScript ES modules - Backend Express application in `Backend/Chatify/server.mjs`, `Backend/Chatify/app.mjs`, `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Config/socket.mjs`.
- TypeScript with TSX - Frontend React application in `Frontend/Chatify/src/main.tsx`, `Frontend/Chatify/src/App.tsx`, `Frontend/Chatify/src/pages/chat/chat.tsx`, `Frontend/Chatify/src/api/axios.ts`.
- JSON - Package manifests and TypeScript/Vercel configuration in `package.json`, `Backend/Chatify/package.json`, `Frontend/Chatify/package.json`, `Frontend/Chatify/tsconfig.json`, `Frontend/Chatify/vercel.json`.
- CSS via Tailwind CSS - Frontend styling framework configured through `Frontend/Chatify/vite.config.ts` and dependency declarations in `Frontend/Chatify/package.json`.

## Runtime

- Node.js - Required for both backend (`Backend/Chatify/package.json`) and frontend build tooling (`Frontend/Chatify/package.json`).
- Browser runtime - React SPA served from the Vite build in `Frontend/Chatify/src/main.tsx`.
- npm - Lockfiles are present at `Backend/Chatify/package-lock.json` and `Frontend/Chatify/package-lock.json`.
- Lockfile: present for backend and frontend; missing for the root `package.json`.

## Frameworks

- Express `^5.1.0` - Backend HTTP API in `Backend/Chatify/app.mjs`.
- React `^19.1.0` and React DOM `^19.1.0` - Frontend UI in `Frontend/Chatify/src/main.tsx` and `Frontend/Chatify/src/App.tsx`.
- Vite `^7.0.4` - Frontend dev server and production build configured in `Frontend/Chatify/vite.config.ts`.
- Socket.IO `^4.8.1` - Backend realtime server in `Backend/Chatify/Config/socket.mjs`.
- Socket.IO Client `^4.8.1` - Frontend realtime client in `Frontend/Chatify/src/hooks/useChatSocket.ts`.
- Mongoose `^8.16.4` - MongoDB ODM used in `Backend/Chatify/Config/DBConfig.mjs`, `Backend/Chatify/Models/userModel.mjs`, `Backend/Chatify/Models/chatModel.mjs`, `Backend/Chatify/Models/messageModel.mjs`, `Backend/Chatify/Models/passwordResetModel.mjs`.
- Not detected - Root and backend `test` scripts intentionally fail with "no test specified" in `package.json` and `Backend/Chatify/package.json`.
- Not detected - Frontend has lint/build scripts but no test framework dependency in `Frontend/Chatify/package.json`.
- TypeScript `~5.8.3` - Frontend typechecking through `tsc -b` in `Frontend/Chatify/package.json`.
- ESLint `^9.30.1` with `typescript-eslint` `^8.35.1` - Frontend linting configured in `Frontend/Chatify/eslint.config.js`.
- `@vitejs/plugin-react` `^4.6.0` - React Fast Refresh and Vite integration in `Frontend/Chatify/vite.config.ts`.
- Tailwind CSS `^4.1.11` and `@tailwindcss/vite` `^4.1.11` - Vite Tailwind plugin configured in `Frontend/Chatify/vite.config.ts`.
- nodemon `^3.1.10` - Backend development dependency in `Backend/Chatify/package.json`; no script currently wires it.

## Key Dependencies

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
- `dotenv` `^17.2.0` - Loads backend environment from `.env` via `import 'dotenv/config'` in `Backend/Chatify/server.mjs`.
- `cors` `^2.8.5` - Cross-origin cookies and API access configured in `Backend/Chatify/app.mjs`.
- `cookie-parser` `^1.4.7` - Cookie access for auth middleware in `Backend/Chatify/app.mjs`.
- `helmet` `^8.1.0` - HTTP header hardening in `Backend/Chatify/app.mjs`.
- `express-rate-limit` `^8.2.1` - Global, auth, session, refresh, and message rate limits in `Backend/Chatify/app.mjs` and `Backend/Chatify/Middlewares/rateLimiters.mjs`.
- `express-mongo-sanitize` `^2.2.0`, `hpp` `^0.2.3`, `xss` `^1.0.15`, `validator` `^13.15.15` - Input sanitization/security dependencies declared in `Backend/Chatify/package.json`; sanitization middleware is mounted in `Backend/Chatify/app.mjs`.
- `csurf` `^1.11.0` - CSRF token endpoint in `Backend/Chatify/app.mjs`; broad route-level CSRF enforcement is commented out.
- `nodemailer` `^7.0.9` and `@types/nodemailer` `^7.0.2` - Email-related dependency declared in `Backend/Chatify/package.json`; password reset currently sends through Brevo with Axios in `Backend/Chatify/Services/emailService.mjs`.

## Configuration

- Backend environment variables are loaded from `Backend/Chatify/.env` through `Backend/Chatify/server.mjs`; the file is present and must not be committed or quoted.
- Frontend Vite environment variables are stored in `Frontend/Chatify/.env`; the file is present and must not be committed or quoted.
- Required backend vars referenced in code: `NODE_ENV`, `PORT`, `PORT_NUMBER`, `MONGODB_URL`, `SECRET_JWT_KEY`, `EXPIRES_IN`, `FRONTEND_ORIGIN`, `FRONTEND_ORIGIN_DEV`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `EMAIL_USER_SENDER`, `BREVO_API_KEY`.
- Required frontend vars referenced in code: `VITE_BACKEND_URL`, `VITE_SOCKET_URL`.
- Backend production OAuth callback base is hard-coded to `https://chatify-ckmn.onrender.com` in `Backend/Chatify/Config/passport.mjs`.
- Frontend production fallback URL is hard-coded to `https://chatify-ten-rho.vercel.app` in `Backend/Chatify/Controller/authController.mjs`.
- Frontend Vite config: `Frontend/Chatify/vite.config.ts` uses React and Tailwind plugins and proxies `/api` to `https://chatify-ckmn.onrender.com`.
- Frontend TypeScript root config: `Frontend/Chatify/tsconfig.json` references `Frontend/Chatify/tsconfig.app.json` and `Frontend/Chatify/tsconfig.node.json`.
- Frontend ESLint config: `Frontend/Chatify/eslint.config.js` enables JS recommended, TypeScript recommended, React Hooks, and React Refresh rules.
- Frontend Vercel config: `Frontend/Chatify/vercel.json` rewrites all routes to `/index.html` for SPA routing.
- Backend start script: `npm start` runs `node server.mjs` from `Backend/Chatify/package.json`.
- Frontend scripts: `npm run dev`, `npm run build`, `npm run lint`, and `npm run preview` are defined in `Frontend/Chatify/package.json`.

## Platform Requirements

- Use Node.js and npm in both `Backend/Chatify` and `Frontend/Chatify`.
- Start backend from `Backend/Chatify` with `npm start`; it listens on `PORT`, `PORT_NUMBER`, or `5000` from `Backend/Chatify/server.mjs`.
- Start frontend from `Frontend/Chatify` with `npm run dev`; Vite defaults to `http://localhost:5173`, matching backend CORS fallback in `Backend/Chatify/app.mjs` and Socket.IO fallback in `Backend/Chatify/Config/socket.mjs`.
- Configure local backend `.env` with MongoDB, JWT, OAuth, Brevo, and frontend origin values before running auth or email flows.
- Configure local frontend `.env` with `VITE_BACKEND_URL` and optionally `VITE_SOCKET_URL` before running against a non-default backend.
- Backend target appears to be Render at `https://chatify-ckmn.onrender.com`, referenced in `Backend/Chatify/Config/passport.mjs` and `Frontend/Chatify/vite.config.ts`.
- Frontend target appears to be Vercel, with SPA rewrite configuration in `Frontend/Chatify/vercel.json` and fallback frontend URL `https://chatify-ten-rho.vercel.app` referenced in `Backend/Chatify/Controller/authController.mjs`.
- MongoDB is required in production through `MONGODB_URL` in `Backend/Chatify/Config/DBConfig.mjs`.
- Cross-domain cookies require `NODE_ENV=production`, secure cookies, and `FRONTEND_ORIGIN` alignment in `Backend/Chatify/app.mjs`, `Backend/Chatify/Config/socket.mjs`, and `Backend/Chatify/Utils/tokenCookieGenerator.mjs`.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Backend files use ESM `.mjs` modules with role-based folders: `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Routes/authRouter.mjs`, `Backend/Chatify/Models/userModel.mjs`, `Backend/Chatify/Utils/asyncErrHandler.mjs`.
- Frontend files use `.ts` for APIs/hooks/utils/types and `.tsx` for React components/pages: `Frontend/Chatify/src/api/authApi.ts`, `Frontend/Chatify/src/hooks/useAuthQuery.ts`, `Frontend/Chatify/src/components/ErrorBoundary.tsx`, `Frontend/Chatify/src/pages/login/login.tsx`.
- Component filename casing is mixed. Use the local file's existing casing when editing; for new components prefer PascalCase to match `Frontend/Chatify/src/components/ErrorBoundary.tsx`, `Frontend/Chatify/src/components/TypingIndicator.tsx`, and `Frontend/Chatify/src/components/Toast.tsx`.
- Some existing component/page files are lowercase or camelCase: `Frontend/Chatify/src/components/loadingSpinner.tsx`, `Frontend/Chatify/src/components/protectedRoute.tsx`, `Frontend/Chatify/src/components/chatifyIcon.tsx`, `Frontend/Chatify/src/pages/login/login.tsx`. Do not rename files as part of unrelated work.
- Backend request handlers are named exports in camelCase and wrapped with async error middleware: `signup`, `login`, `refreshToken`, and `forgotPassword` in `Backend/Chatify/Controller/authController.mjs`; `createChat`, `getAllChats`, and `deleteChat` in `Backend/Chatify/Controller/chatController.mjs`.
- Backend helper factories use camelCase: `createOAuthCallback` and `generateResetCode` in `Backend/Chatify/Controller/authController.mjs`.
- Frontend hooks use the `useX` convention: `useAuthInit`, `useSignup`, `useLogin`, and `useLogout` in `Frontend/Chatify/src/hooks/useAuthQuery.ts`; `useAuthRedirect` in `Frontend/Chatify/src/hooks/useAuthRedirect.ts`; `useChatSocket` in `Frontend/Chatify/src/hooks/useChatSocket.ts`.
- API client methods use verb-oriented camelCase inside exported objects: `fetchCSRFToken`, `checkAuth`, `getLoggedUser`, `verifyPasswordResetCode` in `Frontend/Chatify/src/api/authApi.ts`.
- Backend environment-derived constants use uppercase names: `FRONTEND_URL` in `Backend/Chatify/Controller/authController.mjs`.
- Backend booleans and local request values use camelCase: `isProd`, `rememberMe`, `resetToken`, `redirectUrl` in `Backend/Chatify/Controller/authController.mjs`.
- Frontend state setters and booleans follow React conventions: `showPassword`, `setShowPassword`, `isSubmitting`, `errors` in `Frontend/Chatify/src/pages/login/login.tsx`.
- Zustand store selectors are inline arrow functions: `useAuthStore((state) => state.setUser)` in `Frontend/Chatify/src/hooks/useAuthQuery.ts`.
- Frontend interfaces and type aliases use PascalCase: `AuthState` in `Frontend/Chatify/src/store/authstore.ts`, `LoginFormData` and `SignupFormData` in `Frontend/Chatify/src/utils/validationSchemas.tsx`, `Message`, `Chat`, and `UnreadUpdateEvent` in `Frontend/Chatify/src/types/chat.ts`.
- API response interfaces are colocated with the API module they support: `MessageResponse` and `MessagesResponse` in `Frontend/Chatify/src/api/messageApi.ts`; `ChatResponse` and `ChatsResponse` in `Frontend/Chatify/src/api/chatApi.ts`.
- Backend Mongoose models use PascalCase constants and default exports: `User` in `Backend/Chatify/Models/userModel.mjs`, `Message` in `Backend/Chatify/Models/messageModel.mjs`, `PasswordReset` in `Backend/Chatify/Models/passwordResetModel.mjs`.

## Code Style

- Prettier is not configured; `.prettierrc` is not detected at the repo root or package roots.
- Frontend code is checked by TypeScript and ESLint. Use strict TypeScript-compatible code in `Frontend/Chatify/src` because `Frontend/Chatify/tsconfig.app.json` enables `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, and `noUncheckedSideEffectImports`.
- Frontend style is mixed between semicolon and no-semicolon files. Preserve the local file style when editing: `Frontend/Chatify/src/components/ErrorBoundary.tsx` uses semicolons, while `Frontend/Chatify/src/hooks/useAuthQuery.ts` mostly omits them.
- Backend style is also mixed. Preserve the local style in each file: `Backend/Chatify/Controller/authController.mjs` mixes semicolons and no semicolons; `Backend/Chatify/Routes/authRouter.mjs` uses semicolons consistently.
- Frontend ESLint is configured in `Frontend/Chatify/eslint.config.js`.
- Lint command: run `npm run lint` from `Frontend/Chatify`.
- ESLint applies to `**/*.{ts,tsx}` and ignores `dist` through `globalIgnores(['dist'])` in `Frontend/Chatify/eslint.config.js`.
- Enabled frontend lint configs: `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks` recommended latest, and `eslint-plugin-react-refresh` Vite config in `Frontend/Chatify/eslint.config.js`.
- Backend linting is not detected. `Backend/Chatify/package.json` has no `lint` script and no backend ESLint config was detected.

## Import Organization

- No path aliases are configured. `Frontend/Chatify/tsconfig.app.json` and `Frontend/Chatify/tsconfig.json` do not define `paths`.
- Use relative imports such as `../api/authApi`, `../../utils/validationSchemas`, and `../Models/userModel.mjs`.
- Backend ESM imports include file extensions: `../Controller/authController.mjs` in `Backend/Chatify/Routes/authRouter.mjs`.
- Frontend TypeScript imports omit file extensions: `../api/authApi` in `Frontend/Chatify/src/hooks/useAuthQuery.ts`.

## Error Handling

- Backend async route handlers should use `asyncErrHandler` from `Backend/Chatify/Utils/asyncErrHandler.mjs` so promise rejections flow to Express error middleware.
- Backend operational errors should use `CustomError` from `Backend/Chatify/Utils/customError.mjs` and pass them through `next(new CustomError(message, statusCode))`.
- Backend global error responses are centralized in `Backend/Chatify/Controller/errController.mjs`. Development responses include request metadata and sanitized body fields; production responses hide unexpected errors.
- Backend Mongoose duplicate key and validation errors are translated in `Backend/Chatify/Controller/errController.mjs` with `handleDuplicateKeyError` and `handleValidationError`.
- Frontend React Query mutations handle post-success follow-up work in `onSuccess` and local failure paths in `onError`, as shown in `Frontend/Chatify/src/hooks/useAuthQuery.ts`.
- Frontend Axios errors are narrowed with `axios.isAxiosError` before reading `response?.data?.message`, as shown in `Frontend/Chatify/src/pages/login/login.tsx`.
- UI-level render errors are handled by `Frontend/Chatify/src/components/ErrorBoundary.tsx`.

## Logging

- Backend request logging uses middleware in `Backend/Chatify/Middlewares/requestLogger.mjs`.
- Backend socket and auth flows log with `console.log` and `console.error` in `Backend/Chatify/Config/socket.mjs`, `Backend/Chatify/Middlewares/protectRoutes.mjs`, and `Backend/Chatify/Utils/tokenCookieGenerator.mjs`.
- Frontend error paths log with `console.error` or `console.warn` in `Frontend/Chatify/src/hooks/useAuthQuery.ts`, `Frontend/Chatify/src/hooks/useLocalStorage.ts`, `Frontend/Chatify/src/api/axios.ts`, and `Frontend/Chatify/src/components/ErrorBoundary.tsx`.
- Do not log secrets, full tokens, token previews, emails, OAuth payloads, reset codes, or raw cookie metadata. Replace existing sensitive debug output with structured redacted logging.

## Comments

- Use comments for security or workflow boundaries, such as rate-limit rationale in `Backend/Chatify/Routes/authRouter.mjs` and CSRF route notes in `Backend/Chatify/app.mjs`.
- Use comments for non-obvious lifecycle flows, such as auth initialization in `Frontend/Chatify/src/hooks/useAuthQuery.ts` and OAuth callback handling in `Frontend/Chatify/src/pages/login/login.tsx`.
- Avoid comments that restate simple assignments. Prefer clear names for ordinary request handlers, hooks, and API methods.
- JSDoc/TSDoc is not used as a regular convention.
- Prefer TypeScript interfaces and explicit function names over documentation comments in frontend modules such as `Frontend/Chatify/src/types/chat.ts` and `Frontend/Chatify/src/api/messageApi.ts`.

## Function Design

## Module Design

- Backend controllers, middleware, and socket helpers mostly use named exports for route wiring: `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Middlewares/rateLimiters.mjs`, `Backend/Chatify/Config/socket.mjs`.
- Backend models and app/config modules use default exports: `Backend/Chatify/Models/userModel.mjs`, `Backend/Chatify/app.mjs`, `Backend/Chatify/Config/DBConfig.mjs`.
- Frontend components mostly use default exports: `Frontend/Chatify/src/components/ErrorBoundary.tsx`, `Frontend/Chatify/src/components/ConnectionIndicator.tsx`, `Frontend/Chatify/src/pages/login/login.tsx`.
- Frontend hooks, API clients, stores, schemas, and utilities use named exports: `Frontend/Chatify/src/hooks/useAuthQuery.ts`, `Frontend/Chatify/src/api/authApi.ts`, `Frontend/Chatify/src/store/authstore.ts`, `Frontend/Chatify/src/utils/validationSchemas.tsx`.
- Barrel files are not used. Import directly from the module path, such as `../../components/chatifyIcon` or `../api/authApi`.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Backend bootstrap | Loads environment, imports database config, creates HTTP server, initializes Socket.IO, starts listener | `Backend/Chatify/server.mjs` |
| Express app | Composes security middleware, CORS, queue middleware, OAuth routes, API routers, 404 handler, error handler | `Backend/Chatify/app.mjs` |
| Socket server | Owns real-time rooms, online presence maps, typing events, delivery/read/edit/delete/reaction broadcasts | `Backend/Chatify/Config/socket.mjs` |
| Database config | Connects Mongoose to MongoDB and registers connection lifecycle logs | `Backend/Chatify/Config/DBConfig.mjs` |
| API routers | Map REST paths to controller functions and route-specific middleware | `Backend/Chatify/Routes/*.mjs` |
| Controllers | Validate request context, enforce ownership, call Mongoose models, emit socket events, shape HTTP responses | `Backend/Chatify/Controller/*.mjs` |
| Mongoose models | Define persisted user, chat, message, password reset schemas and schema methods/hooks | `Backend/Chatify/Models/*.mjs` |
| Frontend entry | Creates the React root and provides a TanStack Query client | `Frontend/Chatify/src/main.tsx` |
| Frontend route shell | Initializes auth, wraps routes with providers, guards private/public routes, renders global queue indicator | `Frontend/Chatify/src/App.tsx` |
| Chat page | Orchestrates chat UI state, message rendering, socket callbacks, optimistic actions, unread/read behavior | `Frontend/Chatify/src/pages/chat/chat.tsx` |
| API clients | Centralize typed HTTP calls through the shared Axios instance | `Frontend/Chatify/src/api/*.ts` |
| Query/socket hooks | Encapsulate TanStack Query mutations/cache updates and Socket.IO client event handling | `Frontend/Chatify/src/hooks/*.ts` |
| Zustand stores | Hold auth and presence state shared across components | `Frontend/Chatify/src/store/*.ts` |

## Pattern Overview

- Keep HTTP route definitions in `Backend/Chatify/Routes/*.mjs`; put request behavior in `Backend/Chatify/Controller/*.mjs`.
- Keep durable data contracts in Mongoose models under `Backend/Chatify/Models/*.mjs` and frontend TypeScript types under `Frontend/Chatify/src/types/*.ts`.
- Use `Frontend/Chatify/src/api/*.ts` for raw transport calls; use `Frontend/Chatify/src/hooks/*.ts` for query lifecycle, optimistic updates, socket integration, and cache mutation.
- Use cookies for backend authentication, with frontend requests configured by `Frontend/Chatify/src/api/axios.ts`.
- Use Socket.IO rooms named by chat id for real-time chat events.

## Layers

- Purpose: Define browser routes and access control.
- Location: `Frontend/Chatify/src/App.tsx`
- Contains: `BrowserRouter`, route definitions, `ProtectedRoute`, `PublicRoute`, global providers.
- Depends on: `Frontend/Chatify/src/pages/*`, `Frontend/Chatify/src/components/*`, `Frontend/Chatify/src/hooks/useAuthQuery.ts`, `Frontend/Chatify/src/store/authstore.ts`.
- Used by: `Frontend/Chatify/src/main.tsx`.
- Purpose: Render user-facing workflows and reusable UI elements.
- Location: `Frontend/Chatify/src/pages`, `Frontend/Chatify/src/components`
- Contains: Login, signup, forgot password, chat page, route guards, modals, indicators, toasts.
- Depends on: Hooks, stores, types, CSS modules/global CSS.
- Used by: `Frontend/Chatify/src/App.tsx`.
- Purpose: Hide endpoint paths and Axios details behind typed functions.
- Location: `Frontend/Chatify/src/api`
- Contains: `authApi`, `chatApi`, `messageApi`, `userApi`, shared `axiosInstance`.
- Depends on: `axios`, `Frontend/Chatify/src/types`, `Frontend/Chatify/src/utils/requestQueue.ts`.
- Used by: `Frontend/Chatify/src/hooks/useAuthQuery.ts`, `Frontend/Chatify/src/hooks/useChatQueries.ts`, pages.
- Purpose: Coordinate server state, local app state, optimistic updates, socket events.
- Location: `Frontend/Chatify/src/hooks`, `Frontend/Chatify/src/store`
- Contains: TanStack Query hooks, Socket.IO hook, Zustand auth and presence stores.
- Depends on: API clients, stores, socket.io-client, TanStack Query.
- Used by: Pages and global components.
- Purpose: Accept HTTP and WebSocket traffic.
- Location: `Backend/Chatify/server.mjs`, `Backend/Chatify/app.mjs`, `Backend/Chatify/Config/socket.mjs`
- Contains: Express app composition, HTTP server, Socket.IO server.
- Depends on: Routes, middleware, Passport config, database config.
- Used by: Node runtime via `Backend/Chatify/package.json` scripts.
- Purpose: Bind paths to controller actions and enforce cross-cutting request policy.
- Location: `Backend/Chatify/Routes`, `Backend/Chatify/Middlewares`
- Contains: Express routers, auth protection, rate limiters, queue middleware, request logging, sanitization.
- Depends on: Controllers, utilities, external middleware packages.
- Used by: `Backend/Chatify/app.mjs`.
- Purpose: Own domain mutations, persistence, validation, and side effects.
- Location: `Backend/Chatify/Controller`, `Backend/Chatify/Models`, `Backend/Chatify/Services`, `Backend/Chatify/Utils`
- Contains: Auth, users, chats, messages, password resets, email sending, errors, token cookie generation.
- Depends on: Mongoose models, Socket.IO config, Passport, email service, utilities.
- Used by: Routers and socket helpers.

## Data Flow

### Primary Request Path

### Authentication Flow

### Real-Time Chat Flow

- Server state is primarily cached in TanStack Query through `Frontend/Chatify/src/hooks/useChatQueries.ts` and `Frontend/Chatify/src/hooks/useAuthQuery.ts`.
- Auth session state lives in Zustand at `Frontend/Chatify/src/store/authstore.ts`.
- Presence and typing state lives in Zustand at `Frontend/Chatify/src/store/presenceStore.ts`.
- Local UI state for the main chat workflow is held inside `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Backend process state includes the Socket.IO singleton and socket/user maps in `Backend/Chatify/Config/socket.mjs`.

## Key Abstractions

- Purpose: Keep endpoint path declarations separate from controller logic.
- Examples: `Backend/Chatify/Routes/authRouter.mjs`, `Backend/Chatify/Routes/chatRouter.mjs`, `Backend/Chatify/Routes/messageRouter.mjs`, `Backend/Chatify/Routes/userRouter.mjs`.
- Pattern: Export a configured `Router()` as default; import controller functions by name.
- Purpose: Route async errors into Express error handling.
- Examples: `Backend/Chatify/Utils/asyncErrHandler.mjs`, `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Controller/chatController.mjs`.
- Pattern: Wrap async exported controller functions with `asyncErrHandler(...)`.
- Purpose: Create explicit HTTP error messages/statuses for the global error handler.
- Examples: `Backend/Chatify/Utils/customError.mjs`, `Backend/Chatify/Controller/errController.mjs`.
- Pattern: Call `next(new CustomError(message, statusCode))` from controllers and middleware.
- Purpose: Represent persisted domain entities and schema behavior.
- Examples: `Backend/Chatify/Models/userModel.mjs`, `Backend/Chatify/Models/chatModel.mjs`, `Backend/Chatify/Models/messageModel.mjs`, `Backend/Chatify/Models/passwordResetModel.mjs`.
- Pattern: Define schema, indexes/hooks/methods, export `mongoose.model(...)`.
- Purpose: Share a single Socket.IO server and room/user helper methods across controllers.
- Examples: `Backend/Chatify/Config/socket.mjs`, `Backend/Chatify/Controller/chatController.mjs`, `Backend/Chatify/Controller/messageController.mjs`.
- Pattern: Initialize once with `initSocket(server)`, then access with `getIO()` and helper functions.
- Purpose: Centralize endpoint strings and response types.
- Examples: `Frontend/Chatify/src/api/authApi.ts`, `Frontend/Chatify/src/api/chatApi.ts`, `Frontend/Chatify/src/api/messageApi.ts`, `Frontend/Chatify/src/api/userApi.ts`.
- Pattern: Export object literals whose methods return Axios promises.
- Purpose: Encapsulate query keys, server calls, optimistic cache updates, and mutation invalidation.
- Examples: `Frontend/Chatify/src/hooks/useChatQueries.ts`, `Frontend/Chatify/src/hooks/useAuthQuery.ts`.
- Pattern: Export named hooks and query key helpers from the same feature hook module.
- Purpose: Keep auth-based navigation decisions out of route pages.
- Examples: `Frontend/Chatify/src/components/protectedRoute.tsx`, `Frontend/Chatify/src/components/publicRoute.tsx`.
- Pattern: Wrapper components inspect `useAuthStore()` and return either children or `<Navigate />`.

## Entry Points

- Location: `Backend/Chatify/server.mjs`
- Triggers: Node script from `Backend/Chatify/package.json`.
- Responsibilities: Load environment, import app/database, initialize HTTP and Socket.IO servers, listen on port.
- Location: `Backend/Chatify/app.mjs`
- Triggers: Imported by `Backend/Chatify/server.mjs`.
- Responsibilities: Compose middleware, configure CORS/security, mount routers, expose CSRF endpoint, install error handling.
- Location: `Backend/Chatify/Config/socket.mjs`
- Triggers: `initSocket(httpServer)` from `Backend/Chatify/server.mjs`.
- Responsibilities: Maintain socket membership, presence state, chat rooms, event broadcasts, and exported socket helper functions.
- Location: `Frontend/Chatify/src/main.tsx`
- Triggers: Vite loads `Frontend/Chatify/index.html`.
- Responsibilities: Create React root, install QueryClientProvider, render `App`.
- Location: `Frontend/Chatify/src/App.tsx`
- Triggers: Rendered by `Frontend/Chatify/src/main.tsx`.
- Responsibilities: Initialize auth and route to chat, signup, login, and forgot-password views.

## Architectural Constraints

- **Threading:** Backend request handling runs on the Node.js event loop. Heavy request pressure is shaped with queue middleware in `Backend/Chatify/Middlewares/queueMiddleware.mjs` and queues in `Backend/Chatify/Utils/requestQueue.mjs`.
- **Global state:** `Backend/Chatify/Config/socket.mjs` keeps module-level `io`, `socketToUser`, and `userToSockets`; `Backend/Chatify/Config/DBConfig.mjs` establishes a module-level Mongoose connection; frontend Zustand stores in `Frontend/Chatify/src/store/*.ts` are module-level stores.
- **Circular imports:** Controllers import `getIO()` from `Backend/Chatify/Config/socket.mjs`; `socket.mjs` imports Mongoose models. Keep socket helper dependencies pointed at models only, not controllers, to avoid cycles.
- **Authentication boundary:** Protected backend routes rely on `req.userId` from `Backend/Chatify/Middlewares/protectRoutes.mjs`; controllers that access private data must verify membership/ownership again where resource ids are passed.
- **CORS/cookies:** Backend CORS in `Backend/Chatify/app.mjs` and Socket.IO CORS in `Backend/Chatify/Config/socket.mjs` must stay aligned with frontend origins and cookie credentials.

## Anti-Patterns

### Calling Backend Endpoints Directly From Pages

### Mutating Chat/Message Data Without Membership Checks

### Adding Socket Logic Inside UI Components

### Putting Business Logic In Routers

## Error Handling

- Use `asyncErrHandler` from `Backend/Chatify/Utils/asyncErrHandler.mjs` around async backend controllers.
- Use `CustomError` from `Backend/Chatify/Utils/customError.mjs` with `next(...)` for backend validation/auth failures.
- Use `respondWithChatAccessError(...)` in `Backend/Chatify/Controller/messageController.mjs` for immediate membership/access responses where the controller owns the response.
- Use Axios interceptor retry logic in `Frontend/Chatify/src/api/axios.ts` for 401 refresh and 429 queue pause behavior.
- Use TanStack Query mutation `onError` callbacks in `Frontend/Chatify/src/hooks/useChatQueries.ts` and UI-level toast/error state in `Frontend/Chatify/src/pages/chat/chat.tsx`.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
