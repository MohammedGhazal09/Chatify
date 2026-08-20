# Phase 20: Username Identity And Privacy Foundation - Context

**Gathered:** 2026-06-18
**Status:** Ready for UI design and planning

<domain>
## Phase Boundary

Phase 20 delivers the username identity foundation: persisted unique public usernames, local signup collection, mandatory first-time username setup for existing authenticated users, auth-state propagation, and privacy guardrails that keep email out of public identity surfaces. It does not replace chat discovery or add group conversations; Phase 21 and Phase 22 depend on this work.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**8 requirements are locked.** See `20-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream work MUST read `20-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- `Users.username` persistence, normalization, validation, and unique indexing.
- Local signup username collection and validation.
- Existing authenticated-user username setup flow and route guard.
- Protected CSRF-enforced first-time username setup API.
- Auth/user type propagation for username.
- Public identity/email privacy guardrails needed before username discovery.
- Focused backend, frontend, and privacy tests for the identity foundation.

**Out of scope (from SPEC.md):**
- Username-based direct chat creation - Phase 21 owns replacing `targetEmail` with `targetUsername`.
- Group creation or member selection - Phase 22 owns group behavior after username discovery exists.
- Username login - email login remains the stable auth mechanism for this phase.
- Username changes after first setup - change history, squatting, and abuse controls need a separate policy.
- Broad public username directory/autocomplete - Phase 21 may design exact lookup only; enumeration controls belong there.
- Moderation, reporting, admin reservation management, and impersonation review - later v2 scope.
- Production smoke success claims - existing Phase 14/15/17 blockers still require external environment evidence.

</spec_lock>

<decisions>
## Implementation Decisions

### Username Storage And Validation
- **D-20-01:** Store `username` on `Users` as a normalized lowercase public handle with a migration-safe unique sparse or partial index. Existing users without a username must remain loadable until they complete setup.
- **D-20-02:** Use one backend validation helper as the source of truth and mirror the same contract in frontend validation. The approved grammar is 3-24 characters, starts with a letter or number, allows lowercase letters, numbers, underscore, and dot, rejects consecutive separators, rejects leading/trailing separators, and blocks reserved handles including `admin`, `support`, `api`, `auth`, `chatify`, `settings`, `login`, and `signup`.
- **D-20-03:** Normalize before uniqueness checks and persistence. Duplicate values that only differ by case must collide.

### API Contract
- **D-20-04:** Add a protected username setup endpoint under the existing user route surface, recommended as `PATCH /api/user/username`, instead of adding username mutation logic to auth routes.
- **D-20-05:** The endpoint accepts `{ "username": string }`, requires the existing cookie-authenticated session and CSRF protection, succeeds only when the current user has no username, and returns the account-safe current user payload.
- **D-20-06:** Use current app response conventions where practical: `status: "success"` on success, `400` for malformed or invalid username input, `401` for unauthenticated requests, `403` for missing or invalid CSRF, and `409` for duplicate username or attempted username reset after one is already set.
- **D-20-07:** Do not add username login in this phase. Email remains the private login, OAuth, and reset identifier.

### Signup And Existing-User Setup
- **D-20-08:** Local signup requires username for new accounts and preserves existing first name, last name, email, password, session cookie, and OAuth behavior.
- **D-20-09:** OAuth-created and previously existing users must choose their own username. Do not auto-generate public usernames from email, provider profile names, or database ids.
- **D-20-10:** The mandatory setup gate blocks chat and future discovery/group surfaces for authenticated users without username. It must be refresh-safe and route-based, not just a component-level warning.
- **D-20-11:** The setup flow is first-time only in Phase 20. Username change, release, rename history, and moderation policy are deferred.

### Public Identity And Email Privacy
- **D-20-12:** Owner account/auth/reset contexts may continue returning email to the authenticated owner. Public identity, presence, contact, discovery, socket identity events, fixtures, logs, and screenshots must not expose email.
- **D-20-13:** Public identity payloads should include only the fields needed for display and later discovery: `_id`, `username`, `firstName`, `lastName`, `profilePic`, `identityMark`, and already-authorized presence/privacy fields.
- **D-20-14:** Do not log raw username setup payloads, emails, tokens, OAuth payloads, or reset codes. Prefer user ids, stable error codes, and redacted operational messages.

### UI Direction
- **D-20-15:** Add username to the existing signup form using the current auth-page visual language, form validation style, and error handling.
- **D-20-16:** Add a dedicated username setup surface for authenticated users missing username. It should feel like an account setup step in the product, not a marketing or onboarding page.
- **D-20-17:** Keep setup copy short and functional: field label, validation/error state, submit state, and a clear account context. Avoid explanatory feature text in-app.

### Verification
- **D-20-18:** Backend tests must cover model normalization/validation, unique collisions, signup username behavior, first-time setup, CSRF enforcement, duplicate conflicts, and no second update.
- **D-20-19:** Frontend tests must cover username validation, signup input behavior, missing-username route gate, successful setup navigation, and auth state receiving username.
- **D-20-20:** Privacy verification must include focused backend response assertions and repository searches proving new public/discovery paths and tests do not introduce email exposure.

### Agent Discretion
- The implementation may choose exact helper filenames and component names as long as they follow existing repo conventions and keep large chat files untouched unless explicitly required.
- The implementation may add focused tests using the repo's existing test tools or add the smallest missing test setup necessary for Phase 20 evidence.

</decisions>

<canonical_refs>
## Canonical References

**Downstream work MUST read these before planning or implementing.**

### Phase Scope
- `.planning/phases/20-username-identity-and-privacy-foundation/20-SPEC.md` - Locked Phase 20 requirements, boundaries, constraints, and acceptance criteria.
- `.planning/ROADMAP.md` - Phase 20 goal, success criteria, plan waves, and sequencing before Phase 21 and Phase 22.
- `.planning/REQUIREMENTS.md` - v2 username and privacy requirements `V2-USER-01`, `V2-USER-02`, `V2-USER-03`, and `V2-PRIV-01`.
- `.planning/STATE.md` - Current project state, release blockers that must not be overwritten, and sequencing constraints for phases 20-22.

### Codebase Maps
- `.planning/codebase/STACK.md` - Runtime, package, dependency, and verification constraints.
- `.planning/codebase/ARCHITECTURE.md` - Backend route/controller/model layering and frontend route/API/hook/store layering.
- `.planning/codebase/CONVENTIONS.md` - Naming, error handling, logging, import, and module conventions.

### Source Integration Points
- `Backend/Chatify/Models/userModel.mjs` - Add username persistence, validation, and index.
- `Backend/Chatify/Controller/authController.mjs` - Require username for local signup while preserving email/password/OAuth behavior.
- `Backend/Chatify/Controller/userController.mjs` - Add first-time username setup and adjust public identity serialization.
- `Backend/Chatify/Routes/userRouter.mjs` - Mount the protected CSRF-enforced username setup endpoint.
- `Frontend/Chatify/src/utils/validationSchemas.tsx` - Mirror username validation in form schemas.
- `Frontend/Chatify/src/pages/signup/signup.tsx` - Add signup username input.
- `Frontend/Chatify/src/App.tsx` and `Frontend/Chatify/src/components/protectedRoute.tsx` - Enforce refresh-safe setup gating without overwriting unrelated local changes.
- `Frontend/Chatify/src/store/authstore.ts`, `Frontend/Chatify/src/types/auth.ts`, and `Frontend/Chatify/src/hooks/useAuthQuery.ts` - Propagate username through auth state and typed payloads.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Backend/Chatify/Utils/asyncErrHandler.mjs` and `Backend/Chatify/Utils/customError.mjs`: use for new controller behavior and stable operational errors.
- `Frontend/Chatify/src/api/axios.ts`: use the existing credentialed Axios instance and CSRF handling path for username setup calls.
- `Frontend/Chatify/src/hooks/useAuthQuery.ts`: add or reuse auth mutation patterns so username setup updates Zustand and query state.
- Existing auth page components and form patterns in `Frontend/Chatify/src/pages/login/login.tsx` and `Frontend/Chatify/src/pages/signup/signup.tsx`: reuse visual and validation behavior for username inputs.

### Established Patterns
- Backend routes stay thin and delegate behavior to controller functions.
- Backend ESM imports include `.mjs` extensions; frontend TypeScript imports omit extensions.
- Frontend pages should call API clients through hooks rather than direct Axios calls.
- Zustand holds auth session state; route guards read auth state and decide navigation.
- Sensitive logs must be redacted; public identity payloads should be deliberately shaped instead of returning full Mongoose user documents.

### Integration Points
- Username persistence begins in `userModel.mjs`, then flows through signup, logged-user responses, auth store state, and route guards.
- Mandatory setup connects at the route shell/guard layer so refreshes and direct navigation cannot bypass it.
- Privacy guardrails connect to identity serializers and any public user lists before Phase 21 uses usernames for discovery.

</code_context>

<specifics>
## Specific Ideas

- Username is the public discovery handle; email remains private account infrastructure.
- Existing users should not receive generated usernames. They must explicitly choose a unique handle.
- Group work depends on Phase 20 and Phase 21; this phase must leave a stable username foundation before any member picker is added.

</specifics>

<deferred>
## Deferred Ideas

- Username-based direct chat creation belongs to Phase 21.
- Group conversations and username-selected member picking belong to Phase 22.
- Username login, username changes, handle release policy, public directory/autocomplete, moderation/admin tooling, channels, bots, integrations, end-to-end encryption, and group calls are later v2 scope.

</deferred>

---

*Phase: 20-username-identity-and-privacy-foundation*
*Context gathered: 2026-06-18*
