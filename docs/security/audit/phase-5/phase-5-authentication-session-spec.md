# Security Audit Phase 5 — Authentication and Session Security Specification

## Purpose

Phase 5 makes authentication identity, credential recovery, OAuth handoff, access-token validation, refresh-token rotation, multi-factor challenges, cookies, CSRF boundaries, and session revocation explicit fail-closed controls.

This phase is stacked on the exact verified Phase 4 commit `ca25f1b9e3286cb8e7e805dd00cd5893454d3239`. It must not modify `main`, Phase 1, Phase 2, Phase 3, or the Phase 4 branch.

## Security objectives

1. Every access token is bound to one active server-side session. Tokens without a valid `sessionId` are rejected; the legacy sessionless bypass is removed.
2. Access JWTs use only HS256, carry exact issuer and audience claims, include subject, token type, JWT ID, session ID, issued-at, and expiry claims, and are rejected when any required claim is absent or inconsistent.
3. Access-cookie expiry is derived from the configured access-token duration so the browser cookie cannot outlive or unexpectedly undercut the signed token.
4. Refresh tokens remain opaque, random, server-side hashed, one-time rotating credentials. Reuse revokes the remaining token family.
5. Logout clears cookies and revokes both the refresh credential and any valid access-token session that is presented, including the case where one of the two cookies is absent.
6. Email identities are canonicalized consistently for signup, login, password reset, persistence, and OAuth. Passwords are preserved exactly, accept passphrases and spaces, reject control characters and all-whitespace values, and require 12–128 Unicode code points.
7. OAuth identities require a provider-verified email, never auto-link to an existing email account, validate state before creating a handoff, and exchange an opaque one-time HttpOnly handoff cookie rather than putting a bearer credential in a URL.
8. Password-reset codes remain HMAC-protected, short-lived, non-enumerating, and attempt-limited. A valid reset is consumed atomically so concurrent requests cannot reuse the same code.
9. Two-factor login challenges are short-lived, attempt-limited, one-time, and bound to the request device metadata. Enabling, disabling, or regenerating second-factor recovery material revokes every other active session.
10. Authentication events are logged only through the repository redacting logger and never include passwords, reset codes, OAuth handoffs, cookies, raw email addresses, access tokens, or refresh tokens.
11. All unsafe authentication mutations remain behind signed double-submit CSRF validation and bounded rate limits.
12. Deterministic Phase 5 JSON and Markdown evidence is generated from the reviewed source tree. Drift, missing controls, stale evidence, or failing runtime regressions blocks the phase.

## Compatibility constraints

- Keep Express, MongoDB/Mongoose, Passport, jsonwebtoken, Argon2, existing cookie names, and existing frontend/backend routing.
- Add no runtime or development dependencies.
- Preserve the current login, signup, reset, OAuth, session-management, and two-factor response shapes except where a credential is intentionally removed from a URL.
- Do not touch `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Existing accounts and existing active refresh sessions remain valid. Newly issued access tokens must use the strict Phase 5 claim contract.
- Use Node.js `24.19.0` and npm `11.17.0` exactly.

## Required implementation boundaries

### Authentication identity and password policy

Create `Backend/Chatify/Utils/authIdentity.mjs` with:

- `normalizeEmail(value): string`
- `validatePasswordPolicy(password): { ok: boolean, code?: string, message?: string }`
- `assertPasswordPolicy(password): void`

The Mongoose user schema and every authentication controller/provider lookup must use the same canonical email function. The password field must not use Mongoose `trim`.

### Access and refresh sessions

`createAccessToken(user, session)` must refuse a missing session, sign issuer `chatify-api`, audience `chatify-web`, subject equal to the user ID, and the required Phase 5 claims. `verifyAccessToken(token)` must require the same contract and reject a missing session ID.

`assertActiveSessionClaim` must never return a legacy success result. Logout must revoke a presented access-token session independently of refresh-cookie validity.

### OAuth handoff

The provider callback must compare provider state to the first-party state cookie before persistence. It must store only a SHA-256 hash of a fresh opaque handoff token, set the raw token in an HttpOnly, Secure-in-production, SameSite=Lax, narrowly scoped, 60-second cookie, and redirect to `/api/auth/oauth/finalize` without a query credential. Finalization must atomically consume the matching unexpired record and clear both OAuth cookies on success or failure.

### Password reset and second factor

The password-reset mutation must atomically delete the exact unexpired `{ email, tokenHash }` record before changing the password. A failed code still increments and caps attempts.

Two-factor challenges must store the device metadata hashes produced by `buildSessionMetadataFromRequest`. Verification must reject a metadata mismatch and consume the challenge. Security-setting changes must call `revokeOtherSessionsForUser` after persistence.

### Evidence and automation

Create:

- `scripts/security/lib/authentication-policy.mjs`
- `scripts/security/lib/phase5-reproduction.mjs`
- `scripts/security/phase5-authentication-policy.mjs`
- `scripts/security/phase5-reproduce.mjs`
- `scripts/security/__tests__/phase5-authentication-policy.test.mjs`
- `docs/security/audit/phase-5/authentication-policy.json`
- `docs/security/audit/phase-5/authentication-policy.md`
- `docs/security/audit/phase-5/README.md`
- `.github/workflows/security-phase-5-authentication-session.yml`

Add root scripts `security:phase5:test`, `security:phase5:generate`, `security:phase5:check`, and `security:phase5:reproduce`.

Phase 3 must exclude the two generated Phase 5 policy files from current-tree and history digests, with a regression proving downstream generated evidence cannot make Phase 3 stale.

## Required runtime regressions

The Phase 5 backend regression suite must prove:

- a correctly signed access token without `sessionId` is rejected;
- issuer, audience, subject/user mismatch, token type, and algorithm confusion are rejected;
- mixed-case and whitespace-padded emails map to one canonical identity;
- leading and trailing password spaces are preserved rather than silently removed;
- a password shorter than 12 code points, longer than 128, all whitespace, or containing control characters is rejected;
- logout revokes a valid access session even when the refresh cookie is missing;
- an OAuth provider profile with an unverified email is rejected;
- OAuth finalization uses an opaque one-time cookie and no query credential, rejects state mismatch, and rejects replay;
- two concurrent password-reset requests cannot both consume the same reset code;
- a two-factor challenge cannot be completed from mismatched request metadata;
- changing two-factor security material revokes every other session while preserving the current one.

## Phase exit gate

Phase 5 is complete only when all of the following are true on one immutable branch head:

- Phase 1–5 unit/policy tests pass.
- Phase 1–5 generated evidence checks are current.
- Backend authentication regressions and the complete backend test suite pass.
- The complete frontend test, lint, and production-build suite passes.
- The operations guard passes.
- The permanent foundation and Phase 1–5 workflows complete successfully.
- No temporary implementation workflow or script remains in the tree.
- The pull request remains stacked on `security/phase-4-supply-chain-final` and is not merged automatically.
