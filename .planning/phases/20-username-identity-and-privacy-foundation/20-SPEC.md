# Phase 20: Username Identity And Privacy Foundation - Specification

**Created:** 2026-06-18
**Ambiguity score:** 0.08 (gate: <= 0.20)
**Requirements:** 8 locked

## Goal

Chatify users must have a unique public username for privacy-safe discovery, while email remains private account, login, OAuth, and password-reset data.

## Background

The current `Users` model has `firstName`, `lastName`, unique `email`, auth provider ids, profile image fields, identity marks, and presence settings, but it has no `username` field or username index. Local signup in `Backend/Chatify/Controller/authController.mjs` accepts first name, last name, email, and password only. Frontend signup in `Frontend/Chatify/src/pages/signup/signup.tsx`, `Frontend/Chatify/src/utils/validationSchemas.tsx`, and `Frontend/Chatify/src/types/auth.ts` has the same shape. Auth initialization fetches the logged-in user into Zustand through `Frontend/Chatify/src/hooks/useAuthQuery.ts`.

Existing users, including OAuth users created through `Backend/Chatify/Config/passport.mjs`, can authenticate without a public handle. Chat discovery currently depends on email in `Backend/Chatify/Controller/chatController.mjs`, but moving discovery to username is intentionally deferred to Phase 21. Phase 20 must create the identity foundation first so later direct-chat and group flows do not depend on private emails.

## Requirements

1. **Username field and index**: The user record must store a normalized unique public username.
   - Current: `Backend/Chatify/Models/userModel.mjs` has unique `email` but no username field or index.
   - Target: `Users` has `username` with trim/lowercase normalization, a unique sparse-or-partial index that supports migration, and validation for the approved username grammar.
   - Acceptance: Backend model tests prove valid usernames persist normalized, invalid usernames fail validation, duplicate normalized usernames fail with a duplicate/conflict error, and existing users without usernames can still load before completing setup.

2. **Shared username validation contract**: Backend and frontend must enforce the same username rules.
   - Current: Frontend validation schemas cover email/password/name only, and backend signup does not validate usernames.
   - Target: A shared or mirrored rule set requires 3-24 characters, starts with a letter or number, allows lowercase letters, numbers, underscore, and dot, disallows consecutive separators, disallows leading/trailing separators, and blocks reserved names such as `admin`, `support`, `api`, `auth`, `chatify`, `settings`, `login`, and `signup`.
   - Acceptance: Unit tests cover valid handles, uppercase normalization, too-short/too-long values, invalid characters, separator edge cases, and reserved names on both backend and frontend validation paths.

3. **Signup requires username for local accounts**: New local users must choose a unique username at signup.
   - Current: Signup only collects `firstName`, `lastName`, `email`, and `password`; successful signup immediately issues session cookies.
   - Target: Local signup requires `username`, creates the user with normalized username, returns non-sensitive duplicate/validation feedback, and preserves the existing email/password/session behavior.
   - Acceptance: Backend auth tests and frontend signup tests prove username is required, duplicate username returns a clear conflict/validation response, successful signup stores username and returns a logged-in user with username.

4. **Existing-user setup gate**: Authenticated users without a username must be forced through a username setup flow before chat and discovery surfaces.
   - Current: `ProtectedRoute` only checks authentication; users without usernames can enter the chat page.
   - Target: After auth initialization, users missing `username` are routed to a username setup surface and cannot reach `/` chat or future discovery/group flows until the username update succeeds.
   - Acceptance: Frontend route tests prove a logged-in user without username sees the setup flow, refresh cannot bypass it, successful setup returns to chat, and users with username are not interrupted.

5. **Username setup API**: Authenticated users must be able to set their first username exactly once in this phase.
   - Current: `Backend/Chatify/Routes/userRouter.mjs` has identity, privacy, and profile-image routes, but no username endpoint.
   - Target: A protected CSRF-enforced endpoint sets username for the logged-in user when missing, rejects invalid or duplicate usernames, and refuses username changes after a username exists.
   - Acceptance: Backend route tests verify auth required, CSRF required, invalid values rejected, duplicate values rejected, first set succeeds, and second set fails with a stable error code/status.

6. **Auth and identity propagation**: Auth payloads and frontend auth state must include username where identity is displayed or used.
   - Current: `Frontend/Chatify/src/types/auth.ts` requires `email` on `User` but has no `username`; identity event serialization still includes `email`.
   - Target: Logged-user responses, auth store state, identity event payloads, and identity display helpers include `username`; email is retained only where account/auth/reset surfaces need it.
   - Acceptance: TypeScript build and focused tests prove username is present in the typed user model, shown in setup-aware identity surfaces, and available after signup/login/auth refresh.

7. **Email privacy boundary**: Public identity responses must stop exposing email when email is not needed for account management.
   - Current: `getAllUsers`, identity update events, online status/contact payloads, and frontend fixtures can include email in user-shaped objects.
   - Target: Public/contact/identity responses used outside account settings expose public fields only: `_id`, `username`, `firstName`, `lastName`, `profilePic`, `identityMark`, presence fields already allowed by privacy settings, and no `email`.
   - Acceptance: Backend response tests and frontend fixture/search tests prove public identity, online status, and identity update payloads do not contain email while auth/account responses still provide email to the owner.

8. **Verification evidence**: Phase 20 must leave executable evidence for username and privacy behavior.
   - Current: There are auth, frontend, and security tests, but none cover username setup or email-hiding boundaries.
   - Target: The phase adds focused backend tests, frontend tests, privacy guard checks, and records commands/results in the phase verification artifact.
   - Acceptance: Verification records exact commands and outcomes for backend username/auth tests, frontend validation/route/signup tests, lint/build or documented blockers, and a focused search proving no new public email discovery path was introduced.

## Boundaries

**In scope:**
- `Users.username` persistence, normalization, validation, and unique indexing.
- Local signup username collection and validation.
- Existing authenticated-user username setup flow and route guard.
- Protected CSRF-enforced first-time username setup API.
- Auth/user type propagation for username.
- Public identity/email privacy guardrails needed before username discovery.
- Focused backend, frontend, and privacy tests for the identity foundation.

**Out of scope:**
- Username-based direct chat creation - Phase 21 owns replacing `targetEmail` with `targetUsername`.
- Group creation or member selection - Phase 22 owns group behavior after username discovery exists.
- Username login - email login remains the stable auth mechanism for this phase.
- Username changes after first setup - change history, squatting, and abuse controls need a separate policy.
- Broad public username directory/autocomplete - Phase 21 may design exact lookup only; enumeration controls belong there.
- Moderation, reporting, admin reservation management, and impersonation review - later v2 scope.
- Production smoke success claims - existing Phase 14/15/17 blockers still require external environment evidence.

## Constraints

- Preserve the existing React/Vite, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, and npm package layout.
- Keep cookie-authenticated unsafe username setup requests behind CSRF protection.
- Do not log raw emails or username setup payloads; use user ids and stable redacted codes.
- Preserve unrelated local work, especially existing uncommitted frontend changes and `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Use exact username lookup and owner-only email exposure as the privacy baseline.
- Existing users without username must remain loadable long enough to complete setup; do not require a non-sparse unique index that would break current data migration.

## Acceptance Criteria

- [ ] `Users` persists normalized unique usernames with migration-safe indexing and model validation.
- [ ] Backend and frontend username validation cover length, casing, characters, separators, and reserved names.
- [ ] Local signup requires username and returns clear validation/conflict errors without breaking email/password sessions.
- [ ] Authenticated users missing username are routed to mandatory setup and cannot reach chat until setup succeeds.
- [ ] A protected CSRF-enforced username setup endpoint sets username once and rejects later changes.
- [ ] Logged-in user state and account-safe auth payloads include username.
- [ ] Public identity/contact/presence responses used outside account settings do not expose email.
- [ ] Phase verification records backend tests, frontend tests, lint/build or documented blockers, and privacy search evidence.

## Ambiguity Report

| Dimension          | Score | Min   | Status | Notes |
|--------------------|-------|-------|--------|-------|
| Goal Clarity       | 0.94  | 0.75  | PASS   | Username foundation and email privacy outcome are explicit. |
| Boundary Clarity   | 0.93  | 0.70  | PASS   | Phase 21 discovery and Phase 22 groups are excluded. |
| Constraint Clarity | 0.88  | 0.65  | PASS   | Validation, CSRF, migration, privacy, and repo constraints are stated. |
| Acceptance Criteria| 0.91  | 0.70  | PASS   | Criteria are pass/fail and mapped to tests or inspections. |
| **Ambiguity**      | 0.08  | <=0.20| PASS   | Ready for discuss-phase. |

## Interview Log

User approval was pre-granted by the active goal. The following Socratic questions were discovered in one shot and auto-approved with the recommended answers.

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | Should Phase 20 replace email-based chat creation now or only create identity foundation? | Only create the username/email privacy foundation; Phase 21 owns chat discovery. |
| 1 | Researcher | Should OAuth-created users receive generated usernames automatically? | No automatic public usernames; require user-selected setup to avoid privacy and impersonation surprises. |
| 2 | Simplifier | What is the minimum username policy? | 3-24 normalized lowercase characters with letters, numbers, underscore, dot, separator limits, and reserved names. |
| 2 | Simplifier | Should username login be included? | No; email login/password reset/OAuth remain account infrastructure. |
| 3 | Boundary Keeper | Can users change usernames in this phase? | No; first-time setup only, because rename policy needs abuse and audit decisions. |
| 3 | Boundary Keeper | Where may email still appear? | Owner account/auth/reset contexts only; public identity/contact/presence/discovery payloads must not expose it. |
| 4 | Failure Analyst | What broken outcome would invalidate the phase? | Public endpoints still exposing email, bypassable setup gate, duplicate usernames, or non-migration-safe index. |
| 5 | Seed Closer | What evidence proves readiness for Phase 21? | Tests and searches proving username exists, setup is mandatory, and public discovery inputs no longer need private email exposure. |

---

*Phase: 20-username-identity-and-privacy-foundation*
*Spec created: 2026-06-18*
*Next step: $gsd-discuss-phase 20 - implementation decisions (how to build what's specified above)*
