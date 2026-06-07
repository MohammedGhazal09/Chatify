# Testing Patterns

**Analysis Date:** 2026-06-07

## Test Framework

**Runner:**
- Not detected.
- No `jest.config.*`, `vitest.config.*`, `playwright.config.*`, or `cypress` config files were detected in the repo.
- Root `package.json` defines `"test": "echo \"Error: no test specified\" && exit 1"`.
- Backend `Backend/Chatify/package.json` defines `"test": "echo \"Error: no test specified\" && exit 1"`.
- Frontend `Frontend/Chatify/package.json` has no `test` script.

**Assertion Library:**
- Not detected.
- No installed test assertion libraries were found in `Frontend/Chatify/package.json` or `Backend/Chatify/package.json`.

**Run Commands:**
```bash
npm test              # Root placeholder; exits with "Error: no test specified"
cd Backend/Chatify && npm test    # Backend placeholder; exits with "Error: no test specified"
cd Frontend/Chatify && npm run lint    # Available frontend quality check
cd Frontend/Chatify && npm run build   # Available frontend TypeScript/build check
```

## Test File Organization

**Location:**
- Not detected. No `*.test.*` or `*.spec.*` files were found outside ignored dependency/build folders.

**Naming:**
- Not established.
- Recommended convention for future frontend tests: colocate tests beside source files with `.test.ts` or `.test.tsx`, for example `Frontend/Chatify/src/hooks/useAuthQuery.test.tsx` and `Frontend/Chatify/src/components/ErrorBoundary.test.tsx`.
- Recommended convention for future backend tests: add route/controller tests under a dedicated backend test directory or colocated `.test.mjs` files, for example `Backend/Chatify/Controller/authController.test.mjs`.

**Structure:**
```text
Not detected
```

## Test Structure

**Suite Organization:**
```typescript
// No existing suite pattern detected.
// Future tests should group by public module behavior:
describe('useLogin', () => {
  it('stores the logged-in user after a successful login', async () => {
    // arrange API mocks, render hook, act, assert store/query effects
  })
})
```

**Patterns:**
- No setup/teardown pattern is established.
- No assertion pattern is established.
- For frontend hooks, future tests need a React Query `QueryClientProvider` wrapper because `Frontend/Chatify/src/hooks/useAuthQuery.ts` calls `useQueryClient`, `useQuery`, and `useMutation`.
- For frontend route/page tests, future tests need router context because `Frontend/Chatify/src/pages/login/login.tsx` uses `useSearchParams`, `useNavigate`, and `Link`.
- For backend controller tests, future tests need Express `req`, `res`, and `next` mocks or integration tests through the Express app exported from `Backend/Chatify/app.mjs`.

## Mocking

**Framework:** Not detected

**Patterns:**
```typescript
// No existing mocking pattern detected.
// Future frontend tests should mock API modules at module boundaries:
// mock '../api/authApi' when testing Frontend/Chatify/src/hooks/useAuthQuery.ts
```

**What to Mock:**
- Mock Axios/API modules when testing frontend hooks and pages: `Frontend/Chatify/src/api/authApi.ts`, `Frontend/Chatify/src/api/chatApi.ts`, `Frontend/Chatify/src/api/messageApi.ts`, and `Frontend/Chatify/src/api/userApi.ts`.
- Mock browser navigation and `window.location.href` for OAuth login flows in `Frontend/Chatify/src/pages/login/login.tsx` and `Frontend/Chatify/src/pages/signup/signup.tsx`.
- Mock browser storage for `Frontend/Chatify/src/hooks/useLocalStorage.ts` and sound preferences in `Frontend/Chatify/src/utils/sounds.ts`.
- Mock Socket.IO client behavior when testing `Frontend/Chatify/src/hooks/useChatSocket.ts`; assert emitted events such as `user:connect`, `chat:join`, `typing:start`, and `message:delivered`.
- Mock Mongoose models when unit testing backend controllers: `Backend/Chatify/Models/userModel.mjs`, `Backend/Chatify/Models/passwordResetModel.mjs`, `Backend/Chatify/Models/messageModel.mjs`, and `Backend/Chatify/Models/chatModel.mjs`.
- Mock email delivery for password reset flows through `Backend/Chatify/Services/emailService.mjs`.
- Mock JWT/cookie behavior around `Backend/Chatify/Utils/tokenCookieGenerator.mjs` and `Backend/Chatify/Middlewares/protectRoutes.mjs` when testing auth logic.

**What NOT to Mock:**
- Do not mock validation schemas when testing form behavior; use real `loginSchema` and `signupSchema` from `Frontend/Chatify/src/utils/validationSchemas.tsx`.
- Do not mock `CustomError` or `asyncErrHandler` in backend controller tests; they define the public error-handling contract in `Backend/Chatify/Utils/customError.mjs` and `Backend/Chatify/Utils/asyncErrHandler.mjs`.
- Do not mock Zustand stores for all hook tests by default. For `Frontend/Chatify/src/store/authstore.ts`, reset the real store between tests when the goal is to verify auth state updates.

## Fixtures and Factories

**Test Data:**
```typescript
// No existing fixture pattern detected.
// Future fixtures should mirror exported app types:
const user = {
  _id: 'user-id',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
}
```

**Location:**
- Not detected.
- Recommended future frontend fixture locations: `Frontend/Chatify/src/types/auth.ts` and `Frontend/Chatify/src/types/chat.ts` should guide object shapes; test data can live near tests or in `Frontend/Chatify/src/test/fixtures`.
- Recommended future backend fixture locations: use shapes from `Backend/Chatify/Models/userModel.mjs`, `Backend/Chatify/Models/chatModel.mjs`, and `Backend/Chatify/Models/messageModel.mjs`; shared fixtures can live in `Backend/Chatify/test/fixtures`.

## Coverage

**Requirements:** None enforced.

**View Coverage:**
```bash
# Not available until a test runner is added.
```

## Test Types

**Unit Tests:**
- Not present.
- Highest-value frontend unit targets: `Frontend/Chatify/src/utils/validationSchemas.tsx`, `Frontend/Chatify/src/utils/requestQueue.ts`, `Frontend/Chatify/src/hooks/useLocalStorage.ts`, and `Frontend/Chatify/src/store/authstore.ts`.
- Highest-value backend unit targets: `Backend/Chatify/Utils/asyncErrHandler.mjs`, `Backend/Chatify/Utils/customError.mjs`, `Backend/Chatify/Controller/errController.mjs`, and `Backend/Chatify/Utils/requestQueue.mjs`.

**Integration Tests:**
- Not present.
- Highest-value backend integration targets: auth routes in `Backend/Chatify/Routes/authRouter.mjs`, protected route behavior in `Backend/Chatify/Middlewares/protectRoutes.mjs`, and app middleware ordering in `Backend/Chatify/app.mjs`.
- Highest-value frontend integration targets: auth initialization in `Frontend/Chatify/src/hooks/useAuthQuery.ts`, login form behavior in `Frontend/Chatify/src/pages/login/login.tsx`, and chat interactions in `Frontend/Chatify/src/pages/chat/chat.tsx`.

**E2E Tests:**
- Not used.
- No Playwright, Cypress, or browser E2E framework was detected in `package.json`, `Frontend/Chatify/package.json`, or `Backend/Chatify/package.json`.

## Common Patterns

**Async Testing:**
```typescript
// No existing pattern detected.
// Future async tests should await user-visible state or returned promises,
// especially for React Query hooks in Frontend/Chatify/src/hooks/useAuthQuery.ts.
```

**Error Testing:**
```typescript
// No existing pattern detected.
// Future backend tests should assert next receives CustomError:
// expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }))
```

---

*Testing analysis: 2026-06-07*
