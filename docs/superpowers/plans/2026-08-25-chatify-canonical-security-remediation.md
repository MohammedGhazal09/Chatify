# Chatify Canonical Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one reviewable, cumulative, fully verified Chatify security branch and retire unsafe or superseded pull requests.

**Architecture:** Start from the Phase 17 cumulative head, recover Phase 6 through a read-only export, and commit it as normal source before later fixes. Apply each validated remediation at the narrowest shared boundary, add focused regression tests, implement Phase 18, then run one full immutable-head gate and replace the competing PR stack with one canonical PR.

**Tech Stack:** Node.js 24.19.0, npm 11.17.0, Express, Mongoose/MongoDB, Socket.IO, React, TypeScript, Vite, Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-25-chatify-canonical-security-remediation-design.md`

## Global Constraints

- Final history contains no binary commit bundles, base64 patch transports, self-writing workflows, or dependency-refresh artifacts.
- Production security configuration fails closed with actionable errors.
- Existing public HTTP and Socket.IO contracts remain stable unless they are themselves unsafe.
- Every security fix includes a focused regression and a legitimate control case.
- The final merge gate runs on one immutable cumulative head.

---

### Task 1: Recover and expose Phase 6

**Files:**
- Remove: `.github/workflows/security-phase-6-materialize.yml`
- Remove after export: `.security-transfer/phase6-commits.bundle`
- Create temporarily: `.github/workflows/temporary-phase6-source-export.yml`
- Modify/create: ordinary Phase 6 source, tests, workflow, and audit files recovered from commit `faf772e98eeb925456d2e4702d76f33ed0ddd89f`

**Interfaces:**
- Consumes: Phase 5 commit `49e3cb8bd7bd8970d5e57ac2394f51b2dbfd28a1` and the reviewed bundle commit.
- Produces: directly reviewable Phase 6 files with no source-transport machinery.

- [ ] Replace the write-enabled materializer with a `contents: read` export workflow that verifies the bundled commit SHA and uploads `git archive` output.
- [ ] Download and inspect the exported Phase 6 source.
- [ ] Overlay Phase 6 authorization files onto the canonical Phase 17 tree, resolving later-phase changes without dropping Phase 6 invariants.
- [ ] Run Phase 6 focused tests and the nearest authorization suites.
- [ ] Remove the temporary exporter and binary bundle.

### Task 2: Bind secret suppressions to immutable content

**Files:**
- Modify: `scripts/security/lib/secret-detectors.mjs`
- Modify: `scripts/security/lib/secret-scan.mjs`
- Modify: `docs/security/audit/phase-3/secret-scan-allowlist.json`
- Test: `scripts/security/__tests__/phase3-secret-scan.test.mjs`

**Interfaces:**
- Produces: candidate IDs derived from detector, scope, path, line, column, blob identity, and a non-reversible CI-keyed content binding.

- [ ] Add a regression proving a replacement value at an allowlisted location is not suppressed.
- [ ] Add immutable blob identity to history findings and an HMAC binding for exact matched content when `SECRET_SCAN_BINDING_KEY` is available.
- [ ] Require allowlist entries to include the expected binding and blob identity for history suppressions.
- [ ] Regenerate Phase 3 evidence and verify no secret values or reversible hashes are stored.

### Task 3: Correct trusted client-address derivation

**Files:**
- Modify: `Backend/Chatify/Utils/sessionMetadata.mjs`
- Test: `Backend/Chatify/test/auth/phase5-sensitive-flows.test.mjs`

**Interfaces:**
- Produces: request metadata that uses `req.ip`/Express trust-proxy resolution and never parses attacker-controlled forwarding headers directly.

- [ ] Add a regression where a forged leftmost `X-Forwarded-For` value cannot control the metadata hash.
- [ ] Remove direct header parsing and normalize only `req.ip` or the socket remote address fallback.
- [ ] Verify MFA challenge binding and session-management tests.

### Task 4: Verify exact critical-index semantics

**Files:**
- Modify: `Backend/Chatify/Utils/databaseIndexPolicy.mjs`
- Test: `Backend/Chatify/test/security/phase10-database-security.test.mjs`

**Interfaces:**
- Produces: deep canonical comparison of required partial filters and other critical index options.

- [ ] Add a regression with the correct key pattern and a wrong partial filter.
- [ ] Canonicalize nested index option objects and compare exact expected partial-filter semantics.
- [ ] Verify definition and live-index reports reject the mismatched index.

### Task 5: Replace regex-only complex-document validation

**Files:**
- Modify: `Backend/Chatify/Utils/officeDocumentSecurity.mjs`
- Modify: `Backend/Chatify/Utils/uploadContentSecurity.mjs`
- Test: `Backend/Chatify/test/security/phase11-office-container-security.test.mjs`
- Test: `Backend/Chatify/test/security/phase11-upload-security.test.mjs`

**Interfaces:**
- Produces: encoding-aware OOXML relationship inspection and conservative PDF rejection when compressed object streams or unsupported structural features prevent complete active-content analysis.

- [ ] Add UTF-16 OOXML external-relationship and DDE fixtures that bypass raw UTF-8 regex conversion.
- [ ] Decode XML according to BOM/declaration, parse relationship attributes, and reject external targets, macros, objects, ActiveX, and DDE semantics.
- [ ] Add compressed-object-stream PDF fixtures.
- [ ] Reject PDFs containing object streams, xref streams, encryption, or unsupported structures unless a complete parser proves them safe; retain safe simple-PDF support.
- [ ] Verify ordinary DOCX/XLSX/PDF controls remain accepted.

### Task 6: Revalidate connected sessions across processes

**Files:**
- Modify: `Backend/Chatify/Services/socketSessionLifecycleService.mjs`
- Modify: `Backend/Chatify/server.mjs`
- Test: `Backend/Chatify/test/security/phase13-socket-session-lifecycle.test.mjs`

**Interfaces:**
- Produces: `startSocketSessionRevalidationWorker()` and `stopSocketSessionRevalidationWorker()`; each process periodically validates its connected session IDs against MongoDB.

- [ ] Add a regression that revokes a session without invoking local disconnect helpers and observes bounded socket termination.
- [ ] Batch-query active connected session IDs, disconnect missing/revoked/expired sessions, and use a bounded configurable interval.
- [ ] Start after database/socket initialization and stop during graceful shutdown and tests.
- [ ] Preserve immediate local invalidation and token-expiry timers.

### Task 7: Make presence serialization failure-safe

**Files:**
- Modify: `Backend/Chatify/Middlewares/presencePrivacy.mjs`
- Test: `Backend/Chatify/test/security/phase14-presence-metadata-privacy.test.mjs`

**Interfaces:**
- Produces: an async response wrapper that restores the original `res.json` before forwarding failures.

- [ ] Add a regression forcing the database-backed sanitizer to reject and assert a completed 500 response.
- [ ] Restore `res.json` before `next(error)` and guard against double writes.
- [ ] Verify successful single-user and contact-list redaction remains unchanged.

### Task 8: Issue short-lived TURN credentials and bound rate-limit state

**Files:**
- Modify: `Backend/Chatify/Utils/callIceConfig.mjs`
- Modify: `Backend/Chatify/Config/socket.mjs`
- Modify: `Backend/Chatify/Utils/secretConfiguration.mjs`
- Modify: `Backend/Chatify/.env.example`
- Test: `Backend/Chatify/test/security/phase15-call-signaling-security.test.mjs`

**Interfaces:**
- Produces: per-call TURN REST credentials derived from `CALL_TURN_SHARED_SECRET`, expiry, user ID, and call ID; expired socket-rate windows are reclaimed.

- [ ] Add tests proving credentials differ by call/user, expire, and contain no reusable configured password.
- [ ] Require `CALL_TURN_SHARED_SECRET` in production when TURN URLs are configured; allow explicit local-only static fallback outside production.
- [ ] Generate expiry-bound HMAC credentials only after call authorization.
- [ ] Sweep expired rate-limit entries, cap map size, and preserve reconnect-resistant user windows.

### Task 9: Remove deployment-origin hard-coding

**Files:**
- Modify: `Frontend/Chatify/vercel.json`
- Modify: frontend URL trust/configuration utilities and their Phase 16 tests
- Test: `Frontend/Chatify/src/security/deploymentSecurity.test.ts`

**Interfaces:**
- Produces: one canonical production-origin model without a repository-hard-coded backend hostname.

- [ ] Add a regression for a valid alternate configured backend origin.
- [ ] Remove backend-specific rewrites from the committed generic deployment policy.
- [ ] Use validated `VITE_API_ORIGIN` and `VITE_SOCKET_ORIGIN` for direct production connections, while preserving same-origin defaults.
- [ ] Keep CSP compatible with validated HTTPS/WSS endpoints without permitting credentialed or insecure destinations.

### Task 10: Implement Phase 18 privacy and data lifecycle

**Files:**
- Create: `docs/security/audit/phase-18/README.md`
- Create: `.github/workflows/security-phase-18-privacy-data-lifecycle.yml`
- Modify: privacy services, models, controllers, and tests under `Backend/Chatify`

**Interfaces:**
- Produces: atomic worker claims, complete account export inventory, bounded retention/deletion processing, and administrative evidence without private payload leakage.

- [ ] Add atomic claim fields and indexes for privacy deletion work.
- [ ] Include sessions, notification endpoints, attachment lifecycle records, profile-image lifecycle, moderation/account events, and retention summaries in export/deletion coverage.
- [ ] Ensure external storage deletion is idempotent and retryable without marking physical cleanup complete prematurely.
- [ ] Add concurrency, rollback, authorization, export-redaction, and retention-policy regressions.
- [ ] Add a permanent read-only Phase 18 workflow.

### Task 11: Canonical full verification

**Files:**
- Create: `.github/workflows/security-canonical-remediation.yml`
- Remove: temporary export and patch/dependency-refresh workflows

**Interfaces:**
- Produces: one required quality gate on the final cumulative head.

- [ ] Run backend tests and production audit.
- [ ] Run frontend tests, lint, build, and production audit.
- [ ] Run all phase policy/evidence checks and patch hygiene.
- [ ] Verify no transport artifacts, write-enabled PR workflows, or temporary audit files remain.
- [ ] Review the final diff for surviving bypasses and legitimate-flow regressions.

### Task 12: Replace the PR stack

**Files:** GitHub PR metadata only.

- [ ] Open one canonical PR from `security/canonical-remediation-20260825` to `main` with exact verification evidence.
- [ ] Close superseded PRs #8–#21 except any PR intentionally retained only until its directly reviewable source is absorbed.
- [ ] Leave #1, #5, and #10 closed with supersession/security notes.
- [ ] Close #18, #20, and #21 with explicit warnings not to reuse their temporary workflows.
- [ ] Do not mark the canonical PR ready or merge it until the immutable-head full gate is green.
