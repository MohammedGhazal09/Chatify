# Coding Conventions

**Analysis Date:** 2026-06-07

## Naming Patterns

**Files:**
- Backend files use ESM `.mjs` modules with role-based folders: `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Routes/authRouter.mjs`, `Backend/Chatify/Models/userModel.mjs`, `Backend/Chatify/Utils/asyncErrHandler.mjs`.
- Frontend files use `.ts` for APIs/hooks/utils/types and `.tsx` for React components/pages: `Frontend/Chatify/src/api/authApi.ts`, `Frontend/Chatify/src/hooks/useAuthQuery.ts`, `Frontend/Chatify/src/components/ErrorBoundary.tsx`, `Frontend/Chatify/src/pages/login/login.tsx`.
- Component filename casing is mixed. Use the local file's existing casing when editing; for new components prefer PascalCase to match `Frontend/Chatify/src/components/ErrorBoundary.tsx`, `Frontend/Chatify/src/components/TypingIndicator.tsx`, and `Frontend/Chatify/src/components/Toast.tsx`.
- Some existing component/page files are lowercase or camelCase: `Frontend/Chatify/src/components/loadingSpinner.tsx`, `Frontend/Chatify/src/components/protectedRoute.tsx`, `Frontend/Chatify/src/components/chatifyIcon.tsx`, `Frontend/Chatify/src/pages/login/login.tsx`. Do not rename files as part of unrelated work.

**Functions:**
- Backend request handlers are named exports in camelCase and wrapped with async error middleware: `signup`, `login`, `refreshToken`, and `forgotPassword` in `Backend/Chatify/Controller/authController.mjs`; `createChat`, `getAllChats`, and `deleteChat` in `Backend/Chatify/Controller/chatController.mjs`.
- Backend helper factories use camelCase: `createOAuthCallback` and `generateResetCode` in `Backend/Chatify/Controller/authController.mjs`.
- Frontend hooks use the `useX` convention: `useAuthInit`, `useSignup`, `useLogin`, and `useLogout` in `Frontend/Chatify/src/hooks/useAuthQuery.ts`; `useAuthRedirect` in `Frontend/Chatify/src/hooks/useAuthRedirect.ts`; `useChatSocket` in `Frontend/Chatify/src/hooks/useChatSocket.ts`.
- API client methods use verb-oriented camelCase inside exported objects: `fetchCSRFToken`, `checkAuth`, `getLoggedUser`, `verifyPasswordResetCode` in `Frontend/Chatify/src/api/authApi.ts`.

**Variables:**
- Backend environment-derived constants use uppercase names: `FRONTEND_URL` in `Backend/Chatify/Controller/authController.mjs`.
- Backend booleans and local request values use camelCase: `isProd`, `rememberMe`, `resetToken`, `redirectUrl` in `Backend/Chatify/Controller/authController.mjs`.
- Frontend state setters and booleans follow React conventions: `showPassword`, `setShowPassword`, `isSubmitting`, `errors` in `Frontend/Chatify/src/pages/login/login.tsx`.
- Zustand store selectors are inline arrow functions: `useAuthStore((state) => state.setUser)` in `Frontend/Chatify/src/hooks/useAuthQuery.ts`.

**Types:**
- Frontend interfaces and type aliases use PascalCase: `AuthState` in `Frontend/Chatify/src/store/authstore.ts`, `LoginFormData` and `SignupFormData` in `Frontend/Chatify/src/utils/validationSchemas.tsx`, `Message`, `Chat`, and `UnreadUpdateEvent` in `Frontend/Chatify/src/types/chat.ts`.
- API response interfaces are colocated with the API module they support: `MessageResponse` and `MessagesResponse` in `Frontend/Chatify/src/api/messageApi.ts`; `ChatResponse` and `ChatsResponse` in `Frontend/Chatify/src/api/chatApi.ts`.
- Backend Mongoose models use PascalCase constants and default exports: `User` in `Backend/Chatify/Models/userModel.mjs`, `Message` in `Backend/Chatify/Models/messageModel.mjs`, `PasswordReset` in `Backend/Chatify/Models/passwordResetModel.mjs`.

## Code Style

**Formatting:**
- Prettier is not configured; `.prettierrc` is not detected at the repo root or package roots.
- Frontend code is checked by TypeScript and ESLint. Use strict TypeScript-compatible code in `Frontend/Chatify/src` because `Frontend/Chatify/tsconfig.app.json` enables `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, and `noUncheckedSideEffectImports`.
- Frontend style is mixed between semicolon and no-semicolon files. Preserve the local file style when editing: `Frontend/Chatify/src/components/ErrorBoundary.tsx` uses semicolons, while `Frontend/Chatify/src/hooks/useAuthQuery.ts` mostly omits them.
- Backend style is also mixed. Preserve the local style in each file: `Backend/Chatify/Controller/authController.mjs` mixes semicolons and no semicolons; `Backend/Chatify/Routes/authRouter.mjs` uses semicolons consistently.

**Linting:**
- Frontend ESLint is configured in `Frontend/Chatify/eslint.config.js`.
- Lint command: run `npm run lint` from `Frontend/Chatify`.
- ESLint applies to `**/*.{ts,tsx}` and ignores `dist` through `globalIgnores(['dist'])` in `Frontend/Chatify/eslint.config.js`.
- Enabled frontend lint configs: `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks` recommended latest, and `eslint-plugin-react-refresh` Vite config in `Frontend/Chatify/eslint.config.js`.
- Backend linting is not detected. `Backend/Chatify/package.json` has no `lint` script and no backend ESLint config was detected.

## Import Organization

**Order:**
1. External packages first: `react`, `react-router-dom`, `@tanstack/react-query`, `axios`, `mongoose`, `passport`, `jsonwebtoken`.
2. Local API/store/hook/type modules next: `../api/authApi`, `../store/authstore`, `../types/auth` in `Frontend/Chatify/src/hooks/useAuthQuery.ts`.
3. Local backend models/utilities/services after package imports or interleaved with them depending on file style: `../Models/userModel.mjs`, `../Utils/asyncErrHandler.mjs`, `../Utils/customError.mjs`, `../Services/emailService.mjs` in `Backend/Chatify/Controller/authController.mjs`.

**Path Aliases:**
- No path aliases are configured. `Frontend/Chatify/tsconfig.app.json` and `Frontend/Chatify/tsconfig.json` do not define `paths`.
- Use relative imports such as `../api/authApi`, `../../utils/validationSchemas`, and `../Models/userModel.mjs`.
- Backend ESM imports include file extensions: `../Controller/authController.mjs` in `Backend/Chatify/Routes/authRouter.mjs`.
- Frontend TypeScript imports omit file extensions: `../api/authApi` in `Frontend/Chatify/src/hooks/useAuthQuery.ts`.

## Error Handling

**Patterns:**
- Backend async route handlers should use `asyncErrHandler` from `Backend/Chatify/Utils/asyncErrHandler.mjs` so promise rejections flow to Express error middleware.
- Backend operational errors should use `CustomError` from `Backend/Chatify/Utils/customError.mjs` and pass them through `next(new CustomError(message, statusCode))`.
- Backend global error responses are centralized in `Backend/Chatify/Controller/errController.mjs`. Development responses include request metadata and sanitized body fields; production responses hide unexpected errors.
- Backend Mongoose duplicate key and validation errors are translated in `Backend/Chatify/Controller/errController.mjs` with `handleDuplicateKeyError` and `handleValidationError`.
- Frontend React Query mutations handle post-success follow-up work in `onSuccess` and local failure paths in `onError`, as shown in `Frontend/Chatify/src/hooks/useAuthQuery.ts`.
- Frontend Axios errors are narrowed with `axios.isAxiosError` before reading `response?.data?.message`, as shown in `Frontend/Chatify/src/pages/login/login.tsx`.
- UI-level render errors are handled by `Frontend/Chatify/src/components/ErrorBoundary.tsx`.

## Logging

**Framework:** console

**Patterns:**
- Backend request logging uses middleware in `Backend/Chatify/Middlewares/requestLogger.mjs`.
- Backend socket and auth flows log with `console.log` and `console.error` in `Backend/Chatify/Config/socket.mjs`, `Backend/Chatify/Middlewares/protectRoutes.mjs`, and `Backend/Chatify/Utils/tokenCookieGenerator.mjs`.
- Frontend error paths log with `console.error` or `console.warn` in `Frontend/Chatify/src/hooks/useAuthQuery.ts`, `Frontend/Chatify/src/hooks/useLocalStorage.ts`, `Frontend/Chatify/src/api/axios.ts`, and `Frontend/Chatify/src/components/ErrorBoundary.tsx`.
- Do not log secrets or full tokens. Existing token logs in `Backend/Chatify/Middlewares/protectRoutes.mjs` use a token preview; keep future logs similarly redacted.

## Comments

**When to Comment:**
- Use comments for security or workflow boundaries, such as rate-limit rationale in `Backend/Chatify/Routes/authRouter.mjs` and CSRF route notes in `Backend/Chatify/app.mjs`.
- Use comments for non-obvious lifecycle flows, such as auth initialization in `Frontend/Chatify/src/hooks/useAuthQuery.ts` and OAuth callback handling in `Frontend/Chatify/src/pages/login/login.tsx`.
- Avoid comments that restate simple assignments. Prefer clear names for ordinary request handlers, hooks, and API methods.

**JSDoc/TSDoc:**
- JSDoc/TSDoc is not used as a regular convention.
- Prefer TypeScript interfaces and explicit function names over documentation comments in frontend modules such as `Frontend/Chatify/src/types/chat.ts` and `Frontend/Chatify/src/api/messageApi.ts`.

## Function Design

**Size:** Keep new handlers and hooks focused. Existing large workflow files such as `Frontend/Chatify/src/pages/chat/chat.tsx` and `Backend/Chatify/Controller/messageController.mjs` contain many responsibilities; add new isolated helpers/hooks where practical instead of further expanding large files.

**Parameters:** Backend controllers use Express `(req, res, next)` and return JSON responses directly, as in `Backend/Chatify/Controller/authController.mjs`. Frontend hooks accept typed payloads or object parameters for multi-field mutations, as in `useVerifyResetCode` and `useResetPassword` in `Frontend/Chatify/src/hooks/useAuthQuery.ts`.

**Return Values:** Backend route handlers return Express responses or call `next(...)`. Frontend API modules return Axios promises, as in `Frontend/Chatify/src/api/authApi.ts`. React Query hooks return the `useQuery`/`useMutation` result objects, as in `Frontend/Chatify/src/hooks/useAuthQuery.ts`.

## Module Design

**Exports:** 
- Backend controllers, middleware, and socket helpers mostly use named exports for route wiring: `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Middlewares/rateLimiters.mjs`, `Backend/Chatify/Config/socket.mjs`.
- Backend models and app/config modules use default exports: `Backend/Chatify/Models/userModel.mjs`, `Backend/Chatify/app.mjs`, `Backend/Chatify/Config/DBConfig.mjs`.
- Frontend components mostly use default exports: `Frontend/Chatify/src/components/ErrorBoundary.tsx`, `Frontend/Chatify/src/components/ConnectionIndicator.tsx`, `Frontend/Chatify/src/pages/login/login.tsx`.
- Frontend hooks, API clients, stores, schemas, and utilities use named exports: `Frontend/Chatify/src/hooks/useAuthQuery.ts`, `Frontend/Chatify/src/api/authApi.ts`, `Frontend/Chatify/src/store/authstore.ts`, `Frontend/Chatify/src/utils/validationSchemas.tsx`.

**Barrel Files:** 
- Barrel files are not used. Import directly from the module path, such as `../../components/chatifyIcon` or `../api/authApi`.

---

*Convention analysis: 2026-06-07*
