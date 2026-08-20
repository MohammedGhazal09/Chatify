# Architecture

**Analysis Date:** 2026-06-07

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                  Browser React Client                       │
├──────────────────┬──────────────────┬───────────────────────┤
│ Route Shell      │ Feature Pages    │ Shared UI             │
│ `Frontend/Chatify/src/App.tsx` │ `Frontend/Chatify/src/pages` │ `Frontend/Chatify/src/components` │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend State, Queries, API Clients, Socket Hook            │
│ `Frontend/Chatify/src/store`, `Frontend/Chatify/src/hooks`,  │
│ `Frontend/Chatify/src/api`, `Frontend/Chatify/src/types`     │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP cookies + JSON / Socket.IO
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Express API + Socket.IO Server                              │
│ `Backend/Chatify/server.mjs`, `Backend/Chatify/app.mjs`,     │
│ `Backend/Chatify/Config/socket.mjs`                          │
└────────┬───────────────────┬────────────────────┬───────────┘
         │                   │                    │
         ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Routes -> Middleware -> Controllers -> Models/Services       │
│ `Backend/Chatify/Routes`, `Backend/Chatify/Middlewares`,     │
│ `Backend/Chatify/Controller`, `Backend/Chatify/Models`,      │
│ `Backend/Chatify/Services`, `Backend/Chatify/Utils`          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ MongoDB via Mongoose                                        │
│ `Backend/Chatify/Config/DBConfig.mjs`,                       │
│ `Backend/Chatify/Models/*.mjs`                               │
└─────────────────────────────────────────────────────────────┘
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

**Overall:** Split frontend/backend monorepo with a layered Express API and hook-driven React SPA.

**Key Characteristics:**
- Keep HTTP route definitions in `Backend/Chatify/Routes/*.mjs`; put request behavior in `Backend/Chatify/Controller/*.mjs`.
- Keep durable data contracts in Mongoose models under `Backend/Chatify/Models/*.mjs` and frontend TypeScript types under `Frontend/Chatify/src/types/*.ts`.
- Use `Frontend/Chatify/src/api/*.ts` for raw transport calls; use `Frontend/Chatify/src/hooks/*.ts` for query lifecycle, optimistic updates, socket integration, and cache mutation.
- Use cookies for backend authentication, with frontend requests configured by `Frontend/Chatify/src/api/axios.ts`.
- Use Socket.IO rooms named by chat id for real-time chat events.

## Layers

**Frontend Route Layer:**
- Purpose: Define browser routes and access control.
- Location: `Frontend/Chatify/src/App.tsx`
- Contains: `BrowserRouter`, route definitions, `ProtectedRoute`, `PublicRoute`, global providers.
- Depends on: `Frontend/Chatify/src/pages/*`, `Frontend/Chatify/src/components/*`, `Frontend/Chatify/src/hooks/useAuthQuery.ts`, `Frontend/Chatify/src/store/authstore.ts`.
- Used by: `Frontend/Chatify/src/main.tsx`.

**Frontend Page/Component Layer:**
- Purpose: Render user-facing workflows and reusable UI elements.
- Location: `Frontend/Chatify/src/pages`, `Frontend/Chatify/src/components`
- Contains: Login, signup, forgot password, chat page, route guards, modals, indicators, toasts.
- Depends on: Hooks, stores, types, CSS modules/global CSS.
- Used by: `Frontend/Chatify/src/App.tsx`.

**Frontend API Layer:**
- Purpose: Hide endpoint paths and Axios details behind typed functions.
- Location: `Frontend/Chatify/src/api`
- Contains: `authApi`, `chatApi`, `messageApi`, `userApi`, shared `axiosInstance`.
- Depends on: `axios`, `Frontend/Chatify/src/types`, `Frontend/Chatify/src/utils/requestQueue.ts`.
- Used by: `Frontend/Chatify/src/hooks/useAuthQuery.ts`, `Frontend/Chatify/src/hooks/useChatQueries.ts`, pages.

**Frontend State/Query Layer:**
- Purpose: Coordinate server state, local app state, optimistic updates, socket events.
- Location: `Frontend/Chatify/src/hooks`, `Frontend/Chatify/src/store`
- Contains: TanStack Query hooks, Socket.IO hook, Zustand auth and presence stores.
- Depends on: API clients, stores, socket.io-client, TanStack Query.
- Used by: Pages and global components.

**Backend Transport Layer:**
- Purpose: Accept HTTP and WebSocket traffic.
- Location: `Backend/Chatify/server.mjs`, `Backend/Chatify/app.mjs`, `Backend/Chatify/Config/socket.mjs`
- Contains: Express app composition, HTTP server, Socket.IO server.
- Depends on: Routes, middleware, Passport config, database config.
- Used by: Node runtime via `Backend/Chatify/package.json` scripts.

**Backend Routing/Middleware Layer:**
- Purpose: Bind paths to controller actions and enforce cross-cutting request policy.
- Location: `Backend/Chatify/Routes`, `Backend/Chatify/Middlewares`
- Contains: Express routers, auth protection, rate limiters, queue middleware, request logging, sanitization.
- Depends on: Controllers, utilities, external middleware packages.
- Used by: `Backend/Chatify/app.mjs`.

**Backend Domain/Data Layer:**
- Purpose: Own domain mutations, persistence, validation, and side effects.
- Location: `Backend/Chatify/Controller`, `Backend/Chatify/Models`, `Backend/Chatify/Services`, `Backend/Chatify/Utils`
- Contains: Auth, users, chats, messages, password resets, email sending, errors, token cookie generation.
- Depends on: Mongoose models, Socket.IO config, Passport, email service, utilities.
- Used by: Routers and socket helpers.

## Data Flow

### Primary Request Path

1. React mounts with a QueryClient provider in `Frontend/Chatify/src/main.tsx`.
2. `App` calls `useAuthInit()` and gates routes in `Frontend/Chatify/src/App.tsx`.
3. The chat route renders `ChatPage` in `Frontend/Chatify/src/pages/chat/chat.tsx`.
4. `ChatPage` calls query hooks such as `useChats()`, `useMessages()`, and mutations from `Frontend/Chatify/src/hooks/useChatQueries.ts`.
5. Query hooks call typed API clients in `Frontend/Chatify/src/api/chatApi.ts` and `Frontend/Chatify/src/api/messageApi.ts`.
6. API clients use `axiosInstance` from `Frontend/Chatify/src/api/axios.ts`, which sends credentials and handles 429 queue pauses and 401 refresh retries.
7. Express receives requests through `Backend/Chatify/app.mjs`, applies security, CORS, parsing, sanitization, queue, and route middleware.
8. Protected chat/message routes pass through `protect` in `Backend/Chatify/Middlewares/protectRoutes.mjs`.
9. Routers in `Backend/Chatify/Routes/chatRouter.mjs` and `Backend/Chatify/Routes/messageRouter.mjs` dispatch to controllers.
10. Controllers in `Backend/Chatify/Controller/chatController.mjs` and `Backend/Chatify/Controller/messageController.mjs` read/write Mongoose models.
11. Mongoose schemas in `Backend/Chatify/Models/*.mjs` persist data through the connection initialized by `Backend/Chatify/Config/DBConfig.mjs`.
12. Controllers return JSON responses and may emit real-time updates through `getIO()` from `Backend/Chatify/Config/socket.mjs`.

### Authentication Flow

1. Public pages call `useSignup()` or `useLogin()` from `Frontend/Chatify/src/hooks/useAuthQuery.ts`.
2. Auth hooks call `authApi` methods in `Frontend/Chatify/src/api/authApi.ts`.
3. `Backend/Chatify/Routes/authRouter.mjs` applies route-specific rate limiters and calls `Backend/Chatify/Controller/authController.mjs`.
4. `authController` validates credentials against `User` from `Backend/Chatify/Models/userModel.mjs`.
5. `generateTokenAndSetCookie()` in `Backend/Chatify/Utils/tokenCookieGenerator.mjs` sets the `accessToken` cookie.
6. `useAuthInit()` fetches logged-in user data through `/api/user/get-logged-user` and stores it in `Frontend/Chatify/src/store/authstore.ts`.

### Real-Time Chat Flow

1. `useChatSocket()` in `Frontend/Chatify/src/hooks/useChatSocket.ts` connects to `VITE_SOCKET_URL` or `VITE_BACKEND_URL`.
2. On connection, the frontend emits `user:connect` with the authenticated user id.
3. `initSocket()` in `Backend/Chatify/Config/socket.mjs` maps sockets to users, auto-joins the user's chat rooms, updates online status, and broadcasts presence.
4. When a message is created over HTTP in `Backend/Chatify/Controller/messageController.mjs`, the controller emits `message:new` to the chat room.
5. `useChatSocket()` receives events and delegates updates to `ChatPage`, which calls local message updaters from `useMessages()`.
6. Delivery, read, typing, edit, delete, reaction, unread, and chat create/delete events flow through the same Socket.IO room/user-socket helpers.

**State Management:**
- Server state is primarily cached in TanStack Query through `Frontend/Chatify/src/hooks/useChatQueries.ts` and `Frontend/Chatify/src/hooks/useAuthQuery.ts`.
- Auth session state lives in Zustand at `Frontend/Chatify/src/store/authstore.ts`.
- Presence and typing state lives in Zustand at `Frontend/Chatify/src/store/presenceStore.ts`.
- Local UI state for the main chat workflow is held inside `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Backend process state includes the Socket.IO singleton and socket/user maps in `Backend/Chatify/Config/socket.mjs`.

## Key Abstractions

**Express Router Modules:**
- Purpose: Keep endpoint path declarations separate from controller logic.
- Examples: `Backend/Chatify/Routes/authRouter.mjs`, `Backend/Chatify/Routes/chatRouter.mjs`, `Backend/Chatify/Routes/messageRouter.mjs`, `Backend/Chatify/Routes/userRouter.mjs`.
- Pattern: Export a configured `Router()` as default; import controller functions by name.

**Async Controller Wrapper:**
- Purpose: Route async errors into Express error handling.
- Examples: `Backend/Chatify/Utils/asyncErrHandler.mjs`, `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Controller/chatController.mjs`.
- Pattern: Wrap async exported controller functions with `asyncErrHandler(...)`.

**Custom Error Objects:**
- Purpose: Create explicit HTTP error messages/statuses for the global error handler.
- Examples: `Backend/Chatify/Utils/customError.mjs`, `Backend/Chatify/Controller/errController.mjs`.
- Pattern: Call `next(new CustomError(message, statusCode))` from controllers and middleware.

**Mongoose Models:**
- Purpose: Represent persisted domain entities and schema behavior.
- Examples: `Backend/Chatify/Models/userModel.mjs`, `Backend/Chatify/Models/chatModel.mjs`, `Backend/Chatify/Models/messageModel.mjs`, `Backend/Chatify/Models/passwordResetModel.mjs`.
- Pattern: Define schema, indexes/hooks/methods, export `mongoose.model(...)`.

**Socket.IO Singleton and Helpers:**
- Purpose: Share a single Socket.IO server and room/user helper methods across controllers.
- Examples: `Backend/Chatify/Config/socket.mjs`, `Backend/Chatify/Controller/chatController.mjs`, `Backend/Chatify/Controller/messageController.mjs`.
- Pattern: Initialize once with `initSocket(server)`, then access with `getIO()` and helper functions.

**Typed Frontend API Clients:**
- Purpose: Centralize endpoint strings and response types.
- Examples: `Frontend/Chatify/src/api/authApi.ts`, `Frontend/Chatify/src/api/chatApi.ts`, `Frontend/Chatify/src/api/messageApi.ts`, `Frontend/Chatify/src/api/userApi.ts`.
- Pattern: Export object literals whose methods return Axios promises.

**Query Hooks:**
- Purpose: Encapsulate query keys, server calls, optimistic cache updates, and mutation invalidation.
- Examples: `Frontend/Chatify/src/hooks/useChatQueries.ts`, `Frontend/Chatify/src/hooks/useAuthQuery.ts`.
- Pattern: Export named hooks and query key helpers from the same feature hook module.

**Route Guards:**
- Purpose: Keep auth-based navigation decisions out of route pages.
- Examples: `Frontend/Chatify/src/components/protectedRoute.tsx`, `Frontend/Chatify/src/components/publicRoute.tsx`.
- Pattern: Wrapper components inspect `useAuthStore()` and return either children or `<Navigate />`.

## Entry Points

**Backend Node Process:**
- Location: `Backend/Chatify/server.mjs`
- Triggers: Node script from `Backend/Chatify/package.json`.
- Responsibilities: Load environment, import app/database, initialize HTTP and Socket.IO servers, listen on port.

**Express Application:**
- Location: `Backend/Chatify/app.mjs`
- Triggers: Imported by `Backend/Chatify/server.mjs`.
- Responsibilities: Compose middleware, configure CORS/security, mount routers, expose CSRF endpoint, install error handling.

**Socket.IO Server:**
- Location: `Backend/Chatify/Config/socket.mjs`
- Triggers: `initSocket(httpServer)` from `Backend/Chatify/server.mjs`.
- Responsibilities: Maintain socket membership, presence state, chat rooms, event broadcasts, and exported socket helper functions.

**Frontend React App:**
- Location: `Frontend/Chatify/src/main.tsx`
- Triggers: Vite loads `Frontend/Chatify/index.html`.
- Responsibilities: Create React root, install QueryClientProvider, render `App`.

**Frontend Router:**
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

**What happens:** Pages bypass the typed API layer and call Axios directly.
**Why it's wrong:** It duplicates endpoint strings and skips the shared queue, credentials, refresh, and retry behavior in `Frontend/Chatify/src/api/axios.ts`.
**Do this instead:** Add endpoint methods in `Frontend/Chatify/src/api/*.ts`, then consume them from hooks such as `Frontend/Chatify/src/hooks/useChatQueries.ts` or `Frontend/Chatify/src/hooks/useAuthQuery.ts`.

### Mutating Chat/Message Data Without Membership Checks

**What happens:** A controller uses a chat id or message id without confirming `req.userId` belongs to the resource.
**Why it's wrong:** Chat resources are private and socket broadcasts can leak state to the wrong room.
**Do this instead:** Reuse the membership pattern in `loadChatForUser()` inside `Backend/Chatify/Controller/messageController.mjs` or equivalent checks in `Backend/Chatify/Controller/chatController.mjs`.

### Adding Socket Logic Inside UI Components

**What happens:** Components create socket connections or register event listeners directly.
**Why it's wrong:** It fragments connection lifecycle management and causes duplicate listeners.
**Do this instead:** Extend `Frontend/Chatify/src/hooks/useChatSocket.ts` and pass callbacks into it from page components.

### Putting Business Logic In Routers

**What happens:** `Backend/Chatify/Routes/*.mjs` files perform validation, database calls, or response shaping.
**Why it's wrong:** The backend architecture expects routers to stay as thin path-to-controller maps.
**Do this instead:** Add controller functions in `Backend/Chatify/Controller/*.mjs` and import them into router modules.

## Error Handling

**Strategy:** Backend async route errors use wrappers and a central Express error handler; frontend errors are surfaced through query states, mutation callbacks, route-level guards, and `ErrorBoundary`.

**Patterns:**
- Use `asyncErrHandler` from `Backend/Chatify/Utils/asyncErrHandler.mjs` around async backend controllers.
- Use `CustomError` from `Backend/Chatify/Utils/customError.mjs` with `next(...)` for backend validation/auth failures.
- Use `respondWithChatAccessError(...)` in `Backend/Chatify/Controller/messageController.mjs` for immediate membership/access responses where the controller owns the response.
- Use Axios interceptor retry logic in `Frontend/Chatify/src/api/axios.ts` for 401 refresh and 429 queue pause behavior.
- Use TanStack Query mutation `onError` callbacks in `Frontend/Chatify/src/hooks/useChatQueries.ts` and UI-level toast/error state in `Frontend/Chatify/src/pages/chat/chat.tsx`.

## Cross-Cutting Concerns

**Logging:** Development request logging is installed in `Backend/Chatify/app.mjs` via `Backend/Chatify/Middlewares/requestLogger.mjs`; socket/database/controller failures use `console.error` in backend files; frontend failures use `console.error` and UI feedback in hooks/pages.
**Validation:** Backend validates request fields in controllers and Mongoose schemas; frontend form validation uses schemas in `Frontend/Chatify/src/utils/validationSchemas.tsx` with form pages.
**Authentication:** JWT cookies are issued by `Backend/Chatify/Utils/tokenCookieGenerator.mjs`, checked by `Backend/Chatify/Middlewares/protectRoutes.mjs`, refreshed by `Frontend/Chatify/src/api/axios.ts`, and represented in `Frontend/Chatify/src/store/authstore.ts`.
**Security Middleware:** `Backend/Chatify/app.mjs` applies Helmet, HPP protection, JSON size limits, CORS credentials, cookie parsing, sanitization, and rate limiting.
**Request Backpressure:** Backend queues heavy requests through `Backend/Chatify/Middlewares/queueMiddleware.mjs`; frontend queues outbound requests through `Frontend/Chatify/src/utils/requestQueue.ts`.

---

*Architecture analysis: 2026-06-07*
