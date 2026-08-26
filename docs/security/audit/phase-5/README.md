# Security Audit Phase 5 — Authentication and Session Security

Phase 5 makes authentication identity, access-token validation, refresh rotation, logout, OAuth exchange, password recovery, second-factor challenges, CSRF boundaries, rate limits, and session containment explicit fail-closed controls.

## Permanent controls

| Control | Location | Purpose |
| --- | --- | --- |
| Canonical identity and password policy | `Backend/Chatify/Utils/authIdentity.mjs` | Normalizes email identities consistently and preserves exact 12–128 code-point passwords while rejecting control characters and whitespace-only values. |
| Strict access-token verifier | `Backend/Chatify/Utils/authToken.mjs` | Requires HS256, issuer, audience, subject, user, token type, JWT ID, session ID, issued-at, and expiry claims. |
| Session and refresh lifecycle | `Backend/Chatify/Utils/tokenCookieGenerator.mjs` | Issues only session-bound access tokens, rotates opaque hashed refresh credentials, detects reuse, aligns cookie expiry, and revokes sessions. |
| Active-session boundary | `Backend/Chatify/Utils/sessionMetadata.mjs` | Rejects missing, malformed, expired, revoked, or cross-user session claims. |
| OAuth provider boundary | `Backend/Chatify/Config/passport.mjs` | Requires a provider-verified canonical email and forbids implicit email-based account linking. |
| Opaque OAuth handoff | `Backend/Chatify/Controller/authController.mjs` and `Models/oauthHandoffModel.mjs` | Validates state before provider persistence and exchanges a 60-second, one-time, hashed HttpOnly cookie without URL credentials. |
| Atomic recovery | `Backend/Chatify/Controller/authController.mjs` | Consumes the exact unexpired reset record atomically before changing a password. |
| Bound second factor | `Backend/Chatify/Controller/twoFactorController.mjs` and `Models/twoFactorChallengeModel.mjs` | Binds login challenges to request metadata and revokes every other session after security-material changes. |
| Deterministic policy | `scripts/security/lib/authentication-policy.mjs` | Records reviewed source controls and fails closed on drift or missing invariants. |
| Clean reproduction | `scripts/security/phase5-reproduce.mjs` | Runs inherited security gates, live supply-chain checks, focused authentication regressions, full quality, and operations with sanitized evidence. |
| Permanent workflow | `.github/workflows/security-phase-5-authentication-session.yml` | Performs read-only exact-toolchain verification and always uploads sanitized Phase 5 evidence. |

## Token and session invariants

Every newly issued access token is tied to a persisted refresh session. Verification pins algorithm `HS256`, issuer `chatify-api`, and audience `chatify-web`; it requires `sub`, `userId`, `sessionId`, `type`, `jti`, `iat`, and `exp`, and requires the subject to match the user claim. The request boundary then resolves the session as active, unexpired, unrevoked, and owned by the same user.

Refresh tokens are random opaque values. Only SHA-256 hashes are stored. Rotation first claims and revokes the presented session, issues a successor in the same token family, and records replacement linkage. Reuse of a revoked refresh token revokes the remaining family.

Logout treats the access and refresh cookies independently: it best-effort verifies and revokes a presented access session, separately revokes a presented refresh credential, and clears both cookies regardless of either credential's validity.

## Identity and password handling

Email values are normalized with Unicode NFKC, surrounding-whitespace removal, and locale-stable lowercase before every local and OAuth lookup or write. Passwords are never trimmed or normalized. New and reset passwords must contain 12–128 Unicode code points, contain at least one non-whitespace character, and contain no control characters.

This phase intentionally does not require composition rules such as one uppercase letter or symbol. Length, breach controls outside this repository, rate limiting, second factor, and secure storage provide stronger defenses without silently changing user-selected passphrases.

## OAuth exchange

Provider callbacks validate the returned state against the first-party state cookie before Passport performs a provider lookup or user persistence. The provider must explicitly mark the selected email as verified. Existing accounts with the same email are never linked automatically.

After provider authentication, the backend creates a random one-time handoff value, stores only its hash, and places the raw value in an HttpOnly, SameSite=Lax, 60-second cookie scoped to `/api/auth/oauth/finalize`. The finalizer atomically consumes the matching unexpired record. No access token, handoff token, reset code, or other bearer credential appears in a redirect URL.

## Recovery and second factor

Password-reset codes are HMAC-protected, short-lived, attempt-limited, and non-enumerating. Reset performs an exact `findOneAndDelete` before mutating the user, so concurrent requests cannot both consume one code.

A two-factor login challenge stores only hashes of request metadata. Verification rejects and consumes a challenge when the request metadata differs. Enabling or disabling two factor, and regenerating backup codes, revokes every other active session while preserving the current authenticated session.

## Deterministic and runtime gates

Run:

```bash
npm run security:phase5:test
npm run security:phase5:generate
npm run security:phase5:check
npm run security:phase5:reproduce
```

Committed evidence is deterministic and contains no timestamps or authentication material. The reproduction artifact contains command names, exit codes, durations, repository/toolchain metadata, file hashes, and sanitized gate results. It does not store passwords, email addresses, reset codes, OAuth handoffs, cookies, access tokens, refresh tokens, provider credentials, command stderr, or environment values.

## Evidence interpretation

A clean deterministic policy report proves the reviewed source tree contains the required authentication controls. Green runtime regressions prove those controls behaved as expected in an isolated test environment. Live supply-chain evidence proves the registry and advisory services returned acceptable results for the workflow run. None of these substitute for production monitoring, provider-side configuration review, user migration planning, or incident response.

## Administrator-owned settings

Repository automation cannot safely change branch protection, organization policy, OAuth provider consoles, deployment secrets, or production sessions. Administrators should require the foundation and Phase 1–5 checks, review authentication and workflow changes, protect provider callback URLs, rotate credentials after exposure, and maintain emergency session-revocation procedures.
