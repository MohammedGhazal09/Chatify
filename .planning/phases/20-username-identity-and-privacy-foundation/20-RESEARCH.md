---
phase: 20-username-identity-and-privacy-foundation
artifact: research
status: complete
created_at: 2026-06-18T09:40:00+03:00
---

# Phase 20 Research

## Backend Username Findings

- `Backend/Chatify/Models/userModel.mjs` is the correct persistence boundary. It already owns email uniqueness, password/provider fields, profile image fields, identity marks, and `toJSON` redaction.
- The username index must be migration-safe. Existing users can temporarily have no username, so the model should use a unique sparse or partial index rather than a required non-sparse field at schema level.
- A backend username validation helper should live under `Backend/Chatify/Utils/` and be used by both signup and username setup. This avoids duplicated regex and reserved-name behavior in controllers.
- `Backend/Chatify/Controller/authController.mjs` owns local signup and should reject missing/invalid/duplicate username before issuing session cookies.
- `Backend/Chatify/Controller/userController.mjs` is the right home for first-time username setup because user identity/profile/privacy routes already live there.
- `Backend/Chatify/Routes/userRouter.mjs` already has protected user routes and should mount `PATCH /username` with auth protection and the existing CSRF enforcement pattern.
- Backend tests should extend existing Vitest/Supertest suites in `Backend/Chatify/test/auth`, `Backend/Chatify/test/user`, and `Backend/Chatify/test/security`.

## Frontend Username Findings

- `Frontend/Chatify/src/utils/validationSchemas.tsx` defines signup/login form contracts. Add mirrored username validation there and export a username setup schema/type.
- `Frontend/Chatify/src/pages/signup/signup.tsx` already uses React Hook Form, zod resolver, lucide icons, root errors, and mutation error mapping. Username should be added as one field, not a new signup step.
- `Frontend/Chatify/src/api/authApi.ts`, `Frontend/Chatify/src/api/userApi.ts`, and `Frontend/Chatify/src/hooks/useAuthQuery.ts` are the right layers for typed calls and mutation state. Pages should not call Axios directly for username setup.
- `Frontend/Chatify/src/store/authstore.ts` and `Frontend/Chatify/src/types/auth.ts` must add `username?: string` or equivalent while existing users without username remain representable.
- `Frontend/Chatify/src/components/protectedRoute.tsx` is the existing auth gate. Phase 20 should extend route gating or add a sibling guard so users without username cannot enter chat after refresh.
- `Frontend/Chatify/src/App.tsx` is already locally modified. Any route addition must preserve those edits and avoid rewriting unrelated formatting.

## Privacy Findings

- Public identity serialization must be explicit. Returning user-shaped Mongoose documents risks leaking email as username discovery expands in Phase 21.
- Current identity event serialization in `userController` can include email and should be adjusted to account-safe vs public-safe payloads.
- Owner auth/account responses may still include email, but public lists, identity events, presence/contact payloads, tests, logs, and screenshots should not introduce email exposure.
- Phase 20 should add search-based privacy evidence before Phase 21 replaces email-based discovery.

## Testing And Evidence Findings

- Backend `npm test -- --run ...` can target specific Vitest files.
- Frontend `npm test -- --run ...` can target validation, signup, auth hook, and route guard tests.
- Frontend `npm run lint` and `npm run build` remain the final type/lint gates.
- Because the feature changes privacy boundaries, verification should include focused `rg` searches for new public email paths and should document any existing unrelated email references separately.

## Recommendation

Implement in three waves: first add the backend username model/API contract with tests, then add signup/setup UI and route gating with frontend tests, then tighten public identity payloads and capture full verification evidence. Do not touch `Frontend/Chatify/src/pages/chat/chat.tsx` unless a later plan proves it is unavoidable.
