# Codebase Structure

**Analysis Date:** 2026-06-07

## Directory Layout

```text
Chatify/
├── Backend/
│   └── Chatify/
│       ├── Config/          # Database, Passport OAuth, Socket.IO configuration
│       ├── Controller/      # Express controller functions and central error handler
│       ├── Middlewares/     # Auth protection, sanitization, rate limits, queue, logging
│       ├── Models/          # Mongoose schemas/models
│       ├── Routes/          # Express routers
│       ├── Services/        # External service wrappers such as email sending
│       ├── Utils/           # Shared backend helpers
│       ├── app.mjs          # Express app composition
│       ├── server.mjs       # HTTP/Socket.IO bootstrap
│       └── package.json     # Backend package manifest
├── Frontend/
│   └── Chatify/
│       ├── public/          # Static public assets
│       ├── src/
│       │   ├── api/         # Axios instance and typed endpoint clients
│       │   ├── components/  # Reusable React components
│       │   ├── hooks/       # Auth, chat, socket, queue, local storage hooks
│       │   ├── pages/       # Route-level page modules
│       │   ├── store/       # Zustand stores
│       │   ├── types/       # Shared frontend TypeScript types
│       │   ├── utils/       # Frontend utilities and validation schemas
│       │   ├── App.tsx      # Router shell
│       │   ├── main.tsx     # React entry
│       │   ├── App.css      # App styles
│       │   └── index.css    # Global styles
│       ├── index.html       # Vite HTML entry
│       ├── vite.config.ts   # Vite config
│       ├── tsconfig*.json   # TypeScript config
│       └── package.json     # Frontend package manifest
├── .github/                 # Repository GitHub metadata/workflows if present
├── .planning/
│   └── codebase/            # GSD codebase maps
├── package.json             # Root convenience package manifest
└── README.md                # Root project README
```

## Directory Purposes

**`Backend/Chatify`:**
- Purpose: Node.js backend application.
- Contains: Express app, Socket.IO server, Mongoose data layer, OAuth/authentication, REST APIs.
- Key files: `Backend/Chatify/server.mjs`, `Backend/Chatify/app.mjs`, `Backend/Chatify/package.json`.

**`Backend/Chatify/Config`:**
- Purpose: Runtime configuration and singleton setup.
- Contains: Database connection, Passport strategies, Socket.IO server.
- Key files: `Backend/Chatify/Config/DBConfig.mjs`, `Backend/Chatify/Config/passport.mjs`, `Backend/Chatify/Config/socket.mjs`.

**`Backend/Chatify/Controller`:**
- Purpose: Backend request handling and response shaping.
- Contains: Auth, chat, message, user, and error controllers.
- Key files: `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Controller/chatController.mjs`, `Backend/Chatify/Controller/messageController.mjs`, `Backend/Chatify/Controller/userController.mjs`, `Backend/Chatify/Controller/errController.mjs`.

**`Backend/Chatify/Middlewares`:**
- Purpose: Express request preprocessing and protection.
- Contains: Route protection, rate limiters, queue middleware, request logger, sanitization.
- Key files: `Backend/Chatify/Middlewares/protectRoutes.mjs`, `Backend/Chatify/Middlewares/rateLimiters.mjs`, `Backend/Chatify/Middlewares/queueMiddleware.mjs`, `Backend/Chatify/Middlewares/sanitization.mjs`, `Backend/Chatify/Middlewares/requestLogger.mjs`.

**`Backend/Chatify/Models`:**
- Purpose: MongoDB persistence contracts.
- Contains: Mongoose schemas/models for users, chats, messages, password resets.
- Key files: `Backend/Chatify/Models/userModel.mjs`, `Backend/Chatify/Models/chatModel.mjs`, `Backend/Chatify/Models/messageModel.mjs`, `Backend/Chatify/Models/passwordResetModel.mjs`.

**`Backend/Chatify/Routes`:**
- Purpose: API route declarations.
- Contains: Express `Router()` modules grouped by resource.
- Key files: `Backend/Chatify/Routes/authRouter.mjs`, `Backend/Chatify/Routes/userRouter.mjs`, `Backend/Chatify/Routes/chatRouter.mjs`, `Backend/Chatify/Routes/messageRouter.mjs`.

**`Backend/Chatify/Services`:**
- Purpose: External service integration wrappers.
- Contains: Email sending service.
- Key files: `Backend/Chatify/Services/emailService.mjs`.

**`Backend/Chatify/Utils`:**
- Purpose: Backend helpers reused across controllers/middleware.
- Contains: Async error wrapper, custom error class, token cookie generator, request queue, email template.
- Key files: `Backend/Chatify/Utils/asyncErrHandler.mjs`, `Backend/Chatify/Utils/customError.mjs`, `Backend/Chatify/Utils/tokenCookieGenerator.mjs`, `Backend/Chatify/Utils/requestQueue.mjs`, `Backend/Chatify/Utils/emailmsg.mjs`.

**`Frontend/Chatify`:**
- Purpose: Vite React frontend application.
- Contains: SPA source, Vite config, TypeScript config, static assets.
- Key files: `Frontend/Chatify/src/main.tsx`, `Frontend/Chatify/src/App.tsx`, `Frontend/Chatify/package.json`, `Frontend/Chatify/vite.config.ts`.

**`Frontend/Chatify/src/api`:**
- Purpose: Frontend transport layer.
- Contains: Shared Axios instance and typed resource API objects.
- Key files: `Frontend/Chatify/src/api/axios.ts`, `Frontend/Chatify/src/api/authApi.ts`, `Frontend/Chatify/src/api/chatApi.ts`, `Frontend/Chatify/src/api/messageApi.ts`, `Frontend/Chatify/src/api/userApi.ts`.

**`Frontend/Chatify/src/components`:**
- Purpose: Reusable React UI and route guard components.
- Contains: Error boundary, route guards, loading spinner, status indicators, settings modal, toast provider, queue indicator.
- Key files: `Frontend/Chatify/src/components/ErrorBoundary.tsx`, `Frontend/Chatify/src/components/protectedRoute.tsx`, `Frontend/Chatify/src/components/publicRoute.tsx`, `Frontend/Chatify/src/components/Toast.tsx`, `Frontend/Chatify/src/components/SettingsModal.tsx`.

**`Frontend/Chatify/src/hooks`:**
- Purpose: Reusable React logic and side-effect orchestration.
- Contains: Auth query hooks, chat query hooks, Socket.IO hook, redirect hook, queue status hook, local storage hook.
- Key files: `Frontend/Chatify/src/hooks/useAuthQuery.ts`, `Frontend/Chatify/src/hooks/useChatQueries.ts`, `Frontend/Chatify/src/hooks/useChatSocket.ts`, `Frontend/Chatify/src/hooks/useAuthRedirect.ts`, `Frontend/Chatify/src/hooks/useQueueStatus.ts`, `Frontend/Chatify/src/hooks/useLocalStorage.ts`.

**`Frontend/Chatify/src/pages`:**
- Purpose: Route-level screens.
- Contains: Chat, login, signup, forgot password pages.
- Key files: `Frontend/Chatify/src/pages/chat/chat.tsx`, `Frontend/Chatify/src/pages/chat/chat.css`, `Frontend/Chatify/src/pages/login/login.tsx`, `Frontend/Chatify/src/pages/signup/signup.tsx`, `Frontend/Chatify/src/pages/forgotPassword/forgotPassword.tsx`.

**`Frontend/Chatify/src/store`:**
- Purpose: Frontend global state.
- Contains: Zustand stores for auth and presence.
- Key files: `Frontend/Chatify/src/store/authstore.ts`, `Frontend/Chatify/src/store/presenceStore.ts`.

**`Frontend/Chatify/src/types`:**
- Purpose: TypeScript data contracts.
- Contains: Auth and chat/message/presence/event types.
- Key files: `Frontend/Chatify/src/types/auth.ts`, `Frontend/Chatify/src/types/chat.ts`.

**`Frontend/Chatify/src/utils`:**
- Purpose: Frontend utility functions.
- Contains: Request queue, notification sound controls, validation schemas.
- Key files: `Frontend/Chatify/src/utils/requestQueue.ts`, `Frontend/Chatify/src/utils/sounds.ts`, `Frontend/Chatify/src/utils/validationSchemas.tsx`.

## Key File Locations

**Entry Points:**
- `Backend/Chatify/server.mjs`: Starts backend HTTP server and Socket.IO.
- `Backend/Chatify/app.mjs`: Builds Express app and mounts middleware/routes.
- `Frontend/Chatify/index.html`: Vite HTML entry.
- `Frontend/Chatify/src/main.tsx`: React runtime entry.
- `Frontend/Chatify/src/App.tsx`: Client route tree and app providers.

**Configuration:**
- `Backend/Chatify/Config/DBConfig.mjs`: Mongoose connection.
- `Backend/Chatify/Config/passport.mjs`: OAuth strategy setup.
- `Backend/Chatify/Config/socket.mjs`: Socket.IO setup and helper exports.
- `Frontend/Chatify/vite.config.ts`: Frontend build/dev config.
- `Frontend/Chatify/tsconfig.json`: Frontend TypeScript project config.
- `Frontend/Chatify/eslint.config.js`: Frontend lint config.
- `Frontend/Chatify/vercel.json`: Frontend deployment config.

**Core Logic:**
- `Backend/Chatify/Controller/authController.mjs`: Signup, login, logout, token refresh, OAuth callbacks, password reset.
- `Backend/Chatify/Controller/chatController.mjs`: Create, list, and delete chats.
- `Backend/Chatify/Controller/messageController.mjs`: Create, paginate, read, delete, edit, react to messages and calculate unread counts.
- `Backend/Chatify/Controller/userController.mjs`: User profile/session operations.
- `Frontend/Chatify/src/pages/chat/chat.tsx`: Main chat workflow UI.
- `Frontend/Chatify/src/hooks/useChatQueries.ts`: Chat/message query and mutation behavior.
- `Frontend/Chatify/src/hooks/useChatSocket.ts`: Socket.IO client lifecycle and event bridge.
- `Frontend/Chatify/src/hooks/useAuthQuery.ts`: Auth query and mutation behavior.

**Testing:**
- Not detected in the scanned architecture paths. No `*.test.*` or dedicated test directories are part of the mapped structure.

## Naming Conventions

**Files:**
- Backend modules use `.mjs` and resource suffixes: `authController.mjs`, `messageRouter.mjs`, `userModel.mjs`.
- Backend directories are PascalCase plural/domain names: `Controller`, `Routes`, `Models`, `Middlewares`, `Config`, `Services`, `Utils`.
- Frontend React files use `.tsx` for components/pages and `.ts` for hooks, stores, API clients, and types.
- Frontend hooks use `useX.ts` names: `useChatQueries.ts`, `useChatSocket.ts`, `useAuthQuery.ts`.
- Frontend API clients use `resourceApi.ts` names: `authApi.ts`, `chatApi.ts`, `messageApi.ts`, `userApi.ts`.
- Frontend stores use lower camel names ending in `store.ts`: `authstore.ts`, `presenceStore.ts`.
- Route page folders are lowercase or camelCase: `chat`, `login`, `signup`, `forgotPassword`.
- Some component filenames are lower camel case (`protectedRoute.tsx`, `loadingSpinner.tsx`) and some are PascalCase (`ErrorBoundary.tsx`, `SettingsModal.tsx`); follow the local naming style in the target directory when adding adjacent files.

**Directories:**
- Add backend resource groups under the existing top-level backend layer directories, not nested by feature.
- Add frontend route screens under `Frontend/Chatify/src/pages/<routeName>`.
- Add frontend shared UI under `Frontend/Chatify/src/components`.
- Add frontend cross-page logic under `Frontend/Chatify/src/hooks`.
- Add frontend types under `Frontend/Chatify/src/types`.

## Where to Add New Code

**New Backend API Resource:**
- Router: `Backend/Chatify/Routes/<resource>Router.mjs`
- Controller: `Backend/Chatify/Controller/<resource>Controller.mjs`
- Model, if persisted: `Backend/Chatify/Models/<resource>Model.mjs`
- Middleware, if request-wide or reusable: `Backend/Chatify/Middlewares/<purpose>.mjs`
- Shared helper: `Backend/Chatify/Utils/<purpose>.mjs`
- Mount route in: `Backend/Chatify/app.mjs`

**New Backend Auth-Protected Endpoint:**
- Define route in the relevant `Backend/Chatify/Routes/*.mjs`.
- Apply `protect` in `Backend/Chatify/app.mjs` for whole routers or in the router for specific routes.
- Put ownership/membership checks inside the relevant controller in `Backend/Chatify/Controller/*.mjs`.

**New Backend Socket Event:**
- Server event handling and helper exports: `Backend/Chatify/Config/socket.mjs`
- HTTP-triggered broadcasts: emit from the relevant controller after persistence, such as `Backend/Chatify/Controller/messageController.mjs`.
- Client listener/emitter: `Frontend/Chatify/src/hooks/useChatSocket.ts`
- Frontend event type: `Frontend/Chatify/src/types/chat.ts`

**New Frontend Page:**
- Page implementation: `Frontend/Chatify/src/pages/<pageName>/<pageName>.tsx`
- Page stylesheet, if page-specific: `Frontend/Chatify/src/pages/<pageName>/<pageName>.css`
- Route registration: `Frontend/Chatify/src/App.tsx`
- Guarding: wrap in `Frontend/Chatify/src/components/protectedRoute.tsx` or `Frontend/Chatify/src/components/publicRoute.tsx` as appropriate.

**New Frontend Server Interaction:**
- API method: `Frontend/Chatify/src/api/<resource>Api.ts`
- Query/mutation hook: `Frontend/Chatify/src/hooks/use<Resource>Queries.ts`
- Shared response/domain types: `Frontend/Chatify/src/types/<domain>.ts`
- Use `axiosInstance` from `Frontend/Chatify/src/api/axios.ts`; do not create a separate Axios client in pages.

**New Frontend Shared Component:**
- Implementation: `Frontend/Chatify/src/components/<ComponentName>.tsx`
- Use existing stores/hooks for state where possible.
- Keep route-specific large UI in `Frontend/Chatify/src/pages/<pageName>` unless reused across pages.

**Utilities:**
- Backend shared helpers: `Backend/Chatify/Utils`
- Backend external integrations: `Backend/Chatify/Services`
- Frontend shared helpers: `Frontend/Chatify/src/utils`
- Frontend global state: `Frontend/Chatify/src/store`

## Special Directories

**`Backend/Chatify/node_modules`:**
- Purpose: Installed backend dependencies.
- Generated: Yes
- Committed: No

**`Frontend/Chatify/node_modules`:**
- Purpose: Installed frontend dependencies.
- Generated: Yes
- Committed: No

**`Frontend/Chatify/dist`:**
- Purpose: Frontend production build output.
- Generated: Yes
- Committed: No

**`.planning/codebase`:**
- Purpose: GSD-generated codebase reference documents for planning and execution.
- Generated: Yes
- Committed: Yes

**`.codex-atlas-logs`:**
- Purpose: Local agent/tool logs.
- Generated: Yes
- Committed: Not applicable for source changes

**`.vscode`, `Backend/Chatify/.vscode`:**
- Purpose: Editor configuration.
- Generated: No
- Committed: Project-dependent

**`Frontend/Chatify/public`:**
- Purpose: Static assets served by Vite.
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-06-07*
