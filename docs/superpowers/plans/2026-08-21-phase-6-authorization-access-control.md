# Phase 6 Authorization and Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement fail-closed object, role, membership, administrator, integration, and realtime authorization with an exact inventory-backed surface contract and reproducible evidence.

**Architecture:** Preserve the existing domain-specific controllers and models, but move the missing role decisions into a focused authorization utility and make sensitive mutations re-check authority atomically. Build an exact route/socket authorization contract from Phase 1 inventory and a deterministic policy engine that rejects unmapped surfaces or missing source controls. Runtime regressions prove the privilege-escalation and stale-authority fixes; the reproduction command inherits every earlier phase.

**Tech Stack:** Node.js 24.19.0, npm 11.17.0, Express 5, Mongoose 8, Socket.IO 4, Vitest, Node test runner, GitHub Actions.

**Spec:** `docs/security/audit/phase-6/phase-6-authorization-access-control-spec.md`

## Global Constraints

- Base exactly on `49e3cb8bd7bd8970d5e57ac2394f51b2dbfd28a1` from `security/phase-5-authentication-session`.
- Work only on `security/phase-6-authorization-access-control`.
- Add no dependencies and do not modify `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Preserve route paths, response envelopes, cookie names, and existing authorized behavior.
- Write the focused behavior regressions before production changes and verify the expected RED result in CI.
- Generate no timestamped or secret-bearing committed evidence.
- Remove the temporary Phase 6 source-export workflow before final evidence.
- Do not merge the pull request automatically.

---

### Task 1: Establish the exact Phase 6 contract and failing runtime regressions

**Files:**
- Create: `docs/security/audit/phase-6/phase-6-authorization-access-control-spec.md`
- Create: `docs/superpowers/plans/2026-08-21-phase-6-authorization-access-control.md`
- Create: `Backend/Chatify/test/security/phase6-authorization-access-control.test.mjs`

**Interfaces:**
- Consumes: authenticated Supertest agents, Spaces, Chats, IntegrationApp, IntegrationInstallation, administrator routes, and Socket.IO test helpers.
- Produces: black-box regressions for space privilege escalation, stale integration authority, current administrator role, object authorization, and stale socket membership.

- [ ] **Step 1: Write space privilege-escalation regressions**

Create owner, administrator, peer-administrator, and target users. Persist server-side space roles. Assert an administrator receives HTTP 403 when requesting `role: 'admin'`, cannot remove a peer administrator, and the owner can remove that peer administrator.

- [ ] **Step 2: Write stale integration-authority regressions**

Install a scoped integration as a current space administrator. Remove that administrator through the owner endpoint. Assert the runtime token returns HTTP 403, the installation is persisted as revoked, and token rotation returns an opaque not-found response. Create a standard group with a stale `groupAdmin` that is not a member and assert installation is denied.

- [ ] **Step 3: Write current-admin and stale-socket regressions**

Prove the administrator route succeeds after a database promotion and fails immediately after database demotion using the same session. Join a socket room, remove the actor from the stored chat without trusting their existing room membership, and assert the next typing event is denied.

- [ ] **Step 4: Run focused CI and verify RED**

Run in exact CI:

```bash
npm --prefix Backend/Chatify test -- --run test/security/phase6-authorization-access-control.test.mjs
```

Expected: failures show that space admins can grant/remove peer authority, stale integration authority remains usable, or stale integration rotation remains allowed. Existing current-admin and socket reauthorization assertions may already pass and serve as inherited contract coverage.

### Task 2: Add centralized role decisions and atomic space authority checks

**Files:**
- Create: `Backend/Chatify/Utils/authorizationAccess.mjs`
- Modify: `Backend/Chatify/Controller/spaceController.mjs`
- Test: `Backend/Chatify/test/security/phase6-authorization-access-control.test.mjs`
- Test: `Backend/Chatify/test/space/space.membership.test.mjs`

**Interfaces:**
- Produces: `SPACE_ROLE_MUTATIONS`, `buildSpaceAuthorityFilter`, `assertSpaceRoleAssignmentAllowed`, `assertSpaceMemberRemovalAllowed`, and `assertCurrentGroupAdmin`.
- Consumers: space and integration authorization paths.

- [ ] **Step 1: Implement pure server-state role decisions**

`assertSpaceRoleAssignmentAllowed` permits `member` from owner/admin and permits `admin` only from owner. `assertSpaceMemberRemovalAllowed` rejects owner removal and permits administrator-target removal only from the owner. Errors disclose no unrelated member data.

- [ ] **Step 2: Build atomic authority filters**

`buildSpaceAuthorityFilter({ actorId, permission })` returns `$elemMatch` filters for `owner`, `manager`, or `member`. The controller combines the filter with target uniqueness and member-cap constraints so authority is checked in the same `findOneAndUpdate` that changes membership.

- [ ] **Step 3: Replace stale read-then-save membership changes**

For additions, validate user and block state, then atomically `$push` only while the actor still has the required role. For removals, atomically `$pull` only while the actor still has the required role and the target remains removable. Populate and update channel/socket state only after a successful space update.

- [ ] **Step 4: Verify focused and inherited space suites**

```bash
npm --prefix Backend/Chatify test -- --run test/security/phase6-authorization-access-control.test.mjs test/space/space.membership.test.mjs test/space/space.contract.test.mjs test/space/space.join.test.mjs test/space/space.messaging.test.mjs
```

### Task 3: Revalidate integration ownership and target authority

**Files:**
- Modify: `Backend/Chatify/Utils/integrationPermissions.mjs`
- Modify: `Backend/Chatify/Controller/integrationController.mjs`
- Test: `Backend/Chatify/test/security/phase6-authorization-access-control.test.mjs`
- Test: `Backend/Chatify/test/integration/integration-permissions.test.mjs`

**Interfaces:**
- Produces: `assertIntegrationTargetAuthority`, `assertIntegrationInstallationAuthority`, and `revokeIntegrationForLostTargetAuthority`.
- Consumers: install, rotate, revoke, and runtime-token authentication.

- [ ] **Step 1: Centralize target authority**

For a space, require a current owner/admin membership. For a standard group, require `isGroupChat`, not `isSpaceChannel`, current membership, and `groupAdmin` equality. Return only target ID/type/label.

- [ ] **Step 2: Re-check authority during installation lifecycle mutations**

After loading an installation whose app belongs to the actor, call `assertIntegrationInstallationAuthority` before token rotation or revocation. Convert unauthorized or missing target state to the same opaque installation-not-found result.

- [ ] **Step 3: Fail closed at runtime**

After token hash/app/status validation, verify the stored installer still controls the target. On failure, atomically set the installation to revoked, record a sanitized `target_authority_lost` audit reason, and return the existing revoked-installation response without exposing target membership.

- [ ] **Step 4: Verify integration suites**

```bash
npm --prefix Backend/Chatify test -- --run test/security/phase6-authorization-access-control.test.mjs test/integration/integration-permissions.test.mjs
```

### Task 4: Commit an exact inventory-backed surface authorization contract

**Files:**
- Create: `scripts/security/phase6-authorization-contract.json`
- Create: `scripts/security/lib/authorization-policy.mjs`
- Create: `scripts/security/__tests__/phase6-authorization-policy.test.mjs`

**Interfaces:**
- Consumes: `docs/security/audit/phase-1/inventory.json`, the exact contract JSON, and reviewed runtime source files.
- Produces: `buildAuthorizationPolicy`, `assertPhase6ExitGate`, deterministic render/write/check functions, and `PHASE6_GENERATED_PATHS`.

- [ ] **Step 1: Write policy tests and verify RED**

Fixtures prove a healthy exact contract passes; one new HTTP route, one new socket listener, a stale contract entry, a public dynamic private-object route, missing space role containment, missing integration target revalidation, missing current DB admin lookup, or missing socket membership checks produce named violations.

- [ ] **Step 2: Generate and review exact route/socket entries**

Create one sorted contract entry per Phase 1 HTTP route and client-to-server socket listener. Record identity, resource, mutation, private-object concealment, and concrete evidence paths. No wildcard/default entry is allowed.

- [ ] **Step 3: Implement deterministic source controls**

Read exact files, compare inventory keys to contract keys, reject duplicates/extras/missing entries, validate dynamic/private classifications, and evaluate the required runtime source markers. Sort all controls, mappings, and violations without timestamps.

- [ ] **Step 4: Verify policy tests**

```bash
npm run security:phase6:test
```

Expected: all Phase 6 policy tests pass and fixture evidence contains no secret values or current timestamps.

### Task 5: Add CLI, generated evidence, and earlier-phase stability

**Files:**
- Create: `scripts/security/phase6-authorization-policy.mjs`
- Modify: `package.json`
- Modify: `scripts/security/lib/inventory.mjs`
- Modify: `scripts/security/lib/secret-scan.mjs`
- Modify: `scripts/security/__tests__/phase1-downstream-generated-evidence.test.mjs`
- Modify: `scripts/security/__tests__/phase3-downstream-generated-evidence.test.mjs`
- Create: `docs/security/audit/phase-6/authorization-policy.json`
- Create: `docs/security/audit/phase-6/authorization-policy.md`

**Interfaces:**
- Produces: `security:phase6:test`, `security:phase6:generate`, and `security:phase6:check`.

- [ ] **Step 1: Add write/check/json CLI modes**

Follow earlier phases: `--write` writes both deterministic files, `--check` exits nonzero for drift, and `--json` prints sanitized JSON. The default prints Markdown and exits nonzero when the exit gate fails.

- [ ] **Step 2: Exclude downstream Phase 6 evidence**

Add both generated paths to Phase 1 inventory exclusions and Phase 3 current/history exclusions. Extend the exact-list regressions so duplicate or missing exclusions fail.

- [ ] **Step 3: Generate in dependency order and check stability**

```bash
npm run security:phase1:generate
npm run security:phase2:generate
npm run security:phase3:generate
npm run security:phase4:generate
npm run security:phase5:generate
npm run security:phase6:generate
npm run security:phase1:generate
npm run security:phase2:generate
npm run security:phase3:generate
npm run security:phase4:generate
npm run security:phase5:generate
npm run security:phase6:generate
npm run security:phase1:check
npm run security:phase3:check
npm run security:phase6:check
```

### Task 6: Add reproduction, operations documentation, and permanent CI

**Files:**
- Create: `scripts/security/lib/phase6-reproduction.mjs`
- Create: `scripts/security/phase6-reproduce.mjs`
- Create: `scripts/security/__tests__/phase6-reproduction.test.mjs`
- Create: `docs/security/audit/phase-6/README.md`
- Create: `.github/workflows/security-phase-6-authorization-access-control.yml`

**Interfaces:**
- Produces: sanitized `.artifacts/security/phase-6/run-evidence.json` and a permanent read-only workflow.

- [ ] **Step 1: Build the reproduction command plan**

Run clean backend/frontend installs, Phase 4 live supply-chain evidence, Phase 1–6 tests/checks, focused authorization regressions plus inherited authorization suites, complete repository quality, and operations checks. Record only command name, exit code, duration, and sanitized gate state.

- [ ] **Step 2: Document operating and incident behavior**

Explain authorization classes, opaque failures, owner/admin boundaries, integration authority loss, socket reauthorization, evidence interpretation, and operator-owned branch protection.

- [ ] **Step 3: Add permanent CI**

Use full reviewed action SHAs, `contents: read`, exact Node/npm versions, full history/current PR ref fetching, `npm run security:phase6:reproduce`, and sanitized artifact upload.

### Task 7: Remove bootstrap tooling and verify the immutable head

**Files:**
- Delete: `.github/workflows/security-phase-6-source-export.yml`
- Regenerate: Phase 1–6 deterministic evidence.

- [ ] **Step 1: Delete the temporary workflow before final evidence**

The proposed tree must contain only permanent read-only workflows. Confirm no `source-export`, `bootstrap`, `finalizer`, `materialize`, force-push, or self-delete artifact remains.

- [ ] **Step 2: Run complete Phase 6 reproduction**

```bash
npm run security:phase6:reproduce
```

Expected: zero failed commands, all policy/runtime gates true, complete backend/frontend quality green, and operations green.

- [ ] **Step 3: Publish the final branch head**

Push without force, update draft PR #8, and record exact commit, base, changed files, and implemented controls.

- [ ] **Step 4: Verify exact-head GitHub Actions**

Require foundation plus Phase 1–6 permanent workflows to succeed against the same immutable commit. Do not treat a superseded or merge-ref-only run as final evidence.

- [ ] **Step 5: Keep the PR draft and unmerged**

The PR remains stacked on `security/phase-5-authentication-session` until earlier phases are integrated in order.
