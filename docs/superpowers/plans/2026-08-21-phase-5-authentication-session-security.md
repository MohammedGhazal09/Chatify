# Phase 5 Authentication and Session Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a fail-closed authentication and session security phase with strict session-bound JWTs, canonical identities, secure OAuth and reset exchanges, second-factor session containment, deterministic evidence, and permanent CI.

**Architecture:** Keep the existing Express/Mongoose authentication flows but move reusable identity, token, OAuth-handoff, and evidence decisions into focused utilities. Runtime integration tests prove behavior; a deterministic policy engine records and gates the reviewed source contract. Phase 5 is stacked on the verified Phase 4 branch and does not merge automatically.

**Tech Stack:** Node.js 24.19.0, npm 11.17.0, Express 5, Mongoose 8, Passport 0.7, jsonwebtoken 9, Argon2, Vitest, Node test runner, GitHub Actions.

**Spec:** `docs/security/audit/phase-5/phase-5-authentication-session-spec.md`

## Global Constraints

- Base exactly on `ca25f1b9e3286cb8e7e805dd00cd5893454d3239` from `security/phase-4-supply-chain-final`.
- Work only on `security/phase-5-authentication-session`.
- Add no dependencies and do not modify `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Preserve existing API response shapes and cookie names.
- Write each behavior regression before its production change and record the expected failing run.
- Remove every temporary implementation workflow/script before generating final evidence.
- Do not merge the pull request automatically.

---

### Task 1: Establish the Phase 5 branch, specification, and failing runtime contract

**Files:**
- Create: `docs/security/audit/phase-5/phase-5-authentication-session-spec.md`
- Create: `docs/superpowers/plans/2026-08-21-phase-5-authentication-session-security.md`
- Create: `Backend/Chatify/test/auth/phase5-authentication-security.test.mjs`

**Interfaces:**
- Consumes: existing Express app, auth fixtures, Session, User, OAuthHandoff, PasswordReset, and TwoFactorChallenge models.
- Produces: black-box regressions for the Phase 5 runtime contract.

- [ ] **Step 1: Add tests for strict JWT claims and active-session binding**

Create tokens with HS256 but omit `sessionId`, use a wrong issuer/audience, or mismatch `sub` and `userId`; call `/api/user/get-logged-user`; assert HTTP 401 and no authenticated data.

- [ ] **Step 2: Add identity, password, OAuth, reset, logout, and two-factor regressions**

Use real Mongo-backed requests. Assert canonical mixed-case email behavior, exact password-space preservation, 12–128 code-point policy, access-session revocation without a refresh cookie, unverified OAuth rejection, opaque OAuth-cookie finalization, atomic reset consumption, metadata-bound second-factor challenges, and other-session revocation after second-factor security changes.

- [ ] **Step 3: Run the focused suite and verify RED**

Run:

```bash
npm --prefix Backend/Chatify test -- --run test/auth/phase5-authentication-security.test.mjs
```

Expected: the new tests fail because legacy sessionless access, URL OAuth handoff, noncanonical identities, non-atomic reset consumption, or missing second-factor binding still exists.

### Task 2: Canonical identity and password policy

**Files:**
- Create: `Backend/Chatify/Utils/authIdentity.mjs`
- Modify: `Backend/Chatify/Models/userModel.mjs`
- Modify: `Backend/Chatify/Controller/authController.mjs`
- Modify: `Backend/Chatify/Config/passport.mjs`
- Modify: `Frontend/Chatify/src/utils/validationSchemas.tsx`
- Test: `Backend/Chatify/test/auth/phase5-authentication-security.test.mjs`
- Test: `Frontend/Chatify/src/utils/validationSchemas.test.ts`

**Interfaces:**
- Produces: `normalizeEmail`, `validatePasswordPolicy`, and `assertPasswordPolicy`.
- Consumers: user schema, local auth controllers, reset controllers, Passport provider handling, frontend validation.

- [ ] **Step 1: Implement exact normalization and password validation**

`normalizeEmail` returns `String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('en-US')`. Password validation counts Unicode code points, accepts 12–128, rejects control characters and all-whitespace values, and never trims or rewrites the password.

- [ ] **Step 2: Apply one canonical identity boundary**

Normalize every email before lookup/persistence in signup, login, forgot-password, verify-reset-code, reset-password, and OAuth provider handling. Set the Mongoose email setter to `normalizeEmail` and remove password `trim`.

- [ ] **Step 3: Align frontend validation**

Transform signup/login email values through trim/lowercase and require 12–128 characters for newly created passwords.

- [ ] **Step 4: Run focused backend and frontend tests**

```bash
npm --prefix Backend/Chatify test -- --run test/auth/phase5-authentication-security.test.mjs
npm --prefix Frontend/Chatify test -- --run src/utils/validationSchemas.test.ts
```

### Task 3: Strict access-token and session lifecycle

**Files:**
- Modify: `Backend/Chatify/Utils/authToken.mjs`
- Modify: `Backend/Chatify/Utils/tokenCookieGenerator.mjs`
- Modify: `Backend/Chatify/Utils/sessionMetadata.mjs`
- Modify: `Backend/Chatify/Controller/authController.mjs`
- Test: `Backend/Chatify/test/auth/phase5-authentication-security.test.mjs`

**Interfaces:**
- Produces: issuer `chatify-api`, audience `chatify-web`, required session-bound claims, duration-derived cookie expiry, `revokeSessionById`, and `revokeOtherSessionsForUser`.

- [ ] **Step 1: Sign strict access JWTs**

Require a persisted session, set `sub`, `userId`, `sessionId`, `type: access`, and `jti`; sign only HS256 with exact issuer/audience and configured duration.

- [ ] **Step 2: Verify all token invariants**

Require issuer, audience, algorithm, `sub`, `userId`, `sessionId`, `type`, and `jti`; reject subject/user mismatch and any sessionless token.

- [ ] **Step 3: Remove legacy active-session success**

`assertActiveSessionClaim` throws HTTP 401 when `sessionId` is absent, malformed, revoked, expired, or belongs to a different user.

- [ ] **Step 4: Make logout independently revoke both credentials**

Verify a presented access token without failing logout, revoke its session by ID, separately revoke a valid refresh token, always clear both cookies, and emit only sanitized audit metadata.

- [ ] **Step 5: Verify focused lifecycle tests**

```bash
npm --prefix Backend/Chatify test -- --run test/auth/phase5-authentication-security.test.mjs test/auth/auth.lifecycle.test.mjs test/auth/session.management.test.mjs
```

### Task 4: Replace URL OAuth bearer handoff with an opaque cookie exchange

**Files:**
- Modify: `Backend/Chatify/Models/oauthHandoffModel.mjs`
- Modify: `Backend/Chatify/Controller/authController.mjs`
- Modify: `Backend/Chatify/Config/passport.mjs`
- Test: `Backend/Chatify/test/auth/auth.lifecycle.test.mjs`
- Test: `Backend/Chatify/test/auth/oauth-account-linking.test.mjs`
- Test: `Backend/Chatify/test/auth/phase5-authentication-security.test.mjs`

**Interfaces:**
- Produces: SHA-256 `tokenHash` records and `chatify_oauth_handoff` HttpOnly cookie exchange.

- [ ] **Step 1: Require verified provider email**

Reject profiles whose provider cannot prove the selected email is verified. Continue rejecting implicit email-based account linking.

- [ ] **Step 2: Validate state at callback time**

Constant-time compare the provider `state` query value with the first-party state cookie before creating a handoff.

- [ ] **Step 3: Create an opaque handoff cookie**

Generate 32 random bytes, persist only its SHA-256 hash with user/provider/state/expiry, set the raw value as a 60-second HttpOnly cookie scoped to `/api/auth/oauth/finalize`, and redirect to the finalizer without a token query parameter.

- [ ] **Step 4: Atomically consume and clear**

Finalization hashes the cookie, atomically consumes the unexpired matching record, creates the user session, and clears both OAuth cookies on every outcome.

- [ ] **Step 5: Run OAuth suites**

```bash
npm --prefix Backend/Chatify test -- --run test/auth/auth.lifecycle.test.mjs test/auth/oauth-account-linking.test.mjs test/auth/discord-oauth-strategy.test.mjs test/auth/phase5-authentication-security.test.mjs
```

### Task 5: Make recovery and second-factor changes one-time and session-containing

**Files:**
- Modify: `Backend/Chatify/Controller/authController.mjs`
- Modify: `Backend/Chatify/Models/twoFactorChallengeModel.mjs`
- Modify: `Backend/Chatify/Controller/twoFactorController.mjs`
- Modify: `Backend/Chatify/Utils/tokenCookieGenerator.mjs`
- Test: `Backend/Chatify/test/auth/reset.security.test.mjs`
- Test: `Backend/Chatify/test/auth/two-factor.test.mjs`
- Test: `Backend/Chatify/test/auth/phase5-authentication-security.test.mjs`

**Interfaces:**
- Consumes: `normalizeEmail`, `assertPasswordPolicy`, `buildSessionMetadataFromRequest`, `revokeOtherSessionsForUser`.

- [ ] **Step 1: Atomically consume reset codes**

For reset-password, compute the exact HMAC token hash and call `findOneAndDelete` with canonical email, unexpired timestamp, and exact hash before mutating the user. Replayed or concurrent requests receive the existing generic invalid/expired response.

- [ ] **Step 2: Bind two-factor challenges to request metadata**

Persist user-agent and IP hashes when creating a challenge. Verification compares both hashes in constant time and consumes a mismatch as invalid.

- [ ] **Step 3: Revoke other sessions after second-factor security changes**

After enable, disable, or backup-code regeneration succeeds, revoke every active session for the user except `req.sessionId`.

- [ ] **Step 4: Run recovery and MFA suites**

```bash
npm --prefix Backend/Chatify test -- --run test/auth/reset.security.test.mjs test/auth/two-factor.test.mjs test/auth/phase5-authentication-security.test.mjs
```

### Task 6: Add deterministic Phase 5 policy and downstream-evidence stability

**Files:**
- Create: `scripts/security/lib/authentication-policy.mjs`
- Create: `scripts/security/phase5-authentication-policy.mjs`
- Create: `scripts/security/__tests__/phase5-authentication-policy.test.mjs`
- Modify: `scripts/security/lib/secret-scan.mjs`
- Modify: `scripts/security/__tests__/phase3-downstream-generated-evidence.test.mjs`
- Modify: `package.json`
- Create: `docs/security/audit/phase-5/authentication-policy.json`
- Create: `docs/security/audit/phase-5/authentication-policy.md`

**Interfaces:**
- Produces: `buildAuthenticationPolicy`, `assertPhase5ExitGate`, deterministic JSON/Markdown rendering, write/check functions.

- [ ] **Step 1: Write policy tests and verify RED**

Use temporary source fixtures to prove missing session claims, URL handoff tokens, unverified provider email acceptance, non-atomic reset consumption, absent MFA request binding, or missing route CSRF/rate controls produces named violations and a failed exit gate.

- [ ] **Step 2: Implement the policy engine**

Read the reviewed source files as text, evaluate exact invariants, sort evidence and violations deterministically, and render no timestamps or secret values.

- [ ] **Step 3: Exclude Phase 5 generated evidence from Phase 3**

Add `authentication-policy.json` and `.md` to Phase 3 generated exclusions. Extend the downstream regression so committing Phase 4 and Phase 5 generated policy files leaves Phase 3 current/history counts, digests, and findings unchanged.

- [ ] **Step 4: Add root scripts and generate evidence**

```bash
npm run security:phase5:test
npm run security:phase5:generate
npm run security:phase5:check
```

### Task 7: Add clean reproduction, documentation, and permanent CI

**Files:**
- Create: `scripts/security/lib/phase5-reproduction.mjs`
- Create: `scripts/security/phase5-reproduce.mjs`
- Create: `docs/security/audit/phase-5/README.md`
- Create: `.github/workflows/security-phase-5-authentication-session.yml`

**Interfaces:**
- Produces: a 17-step sanitized reproduction report in `.artifacts/security/phase-5/run-evidence.json` and read-only permanent CI.

- [ ] **Step 1: Build the reproduction command plan**

Run clean backend/frontend installs, Phase 1–5 tests and drift checks, focused auth suites, complete repository quality, and operations checks. Store command name, exit code, duration, and sanitized gate state only.

- [ ] **Step 2: Add operating documentation**

Document token/session invariants, OAuth exchange, recovery/MFA containment, evidence interpretation, incident response, and administrator-owned branch-protection requirements.

- [ ] **Step 3: Add the permanent workflow**

Use checkout/setup-node/upload-artifact actions pinned to full reviewed SHAs, `contents: read`, Node 24.19.0, npm 11.17.0, full history/ref fetching, and `npm run security:phase5:reproduce`.

### Task 8: Converge evidence, verify exact head, and publish the stacked draft PR

**Files:**
- Regenerate: Phase 1–5 deterministic evidence files.
- Remove: any temporary implementation workflow or script.

- [ ] **Step 1: Regenerate in dependency order until stable**

```bash
npm run security:phase1:generate
npm run security:phase2:generate
npm run security:phase3:generate
npm run security:phase4:generate
npm run security:phase5:generate
npm run security:phase1:generate
npm run security:phase2:generate
npm run security:phase3:generate
npm run security:phase4:generate
npm run security:phase5:generate
```

- [ ] **Step 2: Check every deterministic phase**

```bash
npm run security:phase1:check
npm run security:phase2:check
npm run security:phase3:check
npm run security:phase4:check
npm run security:phase5:check
```

- [ ] **Step 3: Run the complete Phase 5 reproduction**

```bash
npm run security:phase5:reproduce
```

Expected: zero failed commands, all runtime and policy gates true, backend/frontend quality and operations green.

- [ ] **Step 4: Publish and verify CI**

Push the final commit, verify the temporary implementation files are absent, and require the foundation plus Phase 1–5 permanent workflows to succeed on the exact same head before making a completion claim.

- [ ] **Step 5: Keep the PR draft and unmerged**

Create a draft PR from `security/phase-5-authentication-session` to `security/phase-4-supply-chain-final`. Record implemented controls and exact verification evidence; do not merge.
