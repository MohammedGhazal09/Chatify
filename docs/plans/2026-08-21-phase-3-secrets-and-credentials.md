# Chatify Security Audit Phase 3 Implementation Plan

> Execution date: 2026-08-21
> Base branch: `security/phase-2-threat-model`

## Goal

Implement durable current-tree and complete-history credential scanning, sanitized evidence, fail-closed secret configuration, safe candidate validation, CI enforcement, and a credential-exposure response procedure.

## Design decisions

1. Use Node.js built-ins only so the committed scanner adds no runtime dependency or install script.
2. Never store discovered values, source lines, command output, or hashes of values. Candidate IDs derive from detector and location metadata.
3. Scan tracked files, untracked nonignored files, sensitive ignored local files, and every eligible historical Git blob reachable from the audited `HEAD`.
4. Exclude generated Phase 3 JSON and Markdown from their own current/history inputs to prevent recursive drift.
5. Use an exact candidate-ID allowlist with owner, specific rationale, and mandatory future expiry. No path, detector, or regex wildcards are accepted.
6. Treat findings as candidates until an authorized owner validates them through provider inventory and audit logs; never replay a credential.
7. Validate secrets before importing the Express app, database, Socket.IO, or workers.
8. Require distinct JWT, CSRF, password-reset, and production 2FA encryption purposes, and reject low-entropy core or 2FA key material instead of trusting length alone.
9. Preserve all dependency advisory failures for Phase 4; Phase 3 does not suppress unrelated CI security gates.
10. Fetch required repository refs, but scope the deterministic history scan to the audited `HEAD` ancestor graph so unrelated branches and fork-controlled pull requests cannot perturb another revision’s gate.

## Work items

### 1. Detector and redaction library

Implement provider-aware and generic detectors, placeholder suppression, entropy classification, location-only candidate IDs, and allowlist validation. Test that serialized results do not contain fixture values.

### 2. Current-tree and history scanner

Inventory tracked, untracked, and sensitive local files. Scan all eligible blobs reachable from audited `HEAD` in batches, enrich historical candidates with commit metadata from that same ancestor graph, count skipped binary/oversized files, and produce deterministic digests.

### 3. Secret-loading review and startup validation

Review frontend exposure, weak literal fallbacks, environment dumps, and credential logging. Add `secretConfiguration.mjs`, call it before dynamic runtime imports, remove CSRF fallback to the JWT key, add a separate test CSRF key, reject low-entropy core and 2FA key material, and document the 2FA encryption key.

### 4. Sanitized generation and drift controls

Generate `secret-scan.json` and `secret-scan.md`, validate the exit gate, provide `--write`, `--check`, and `--json` modes, and add regression tests for self-stability and stale output.

### 5. Response and candidate-management documentation

Commit an empty strict allowlist, the credential-exposure response procedure, phase operating instructions, safety rules, provider-specific rotation actions, and limitations.

### 6. Reproduction and CI

Add Phase 3 root commands, a full reproduction runner, and a read-only workflow that fetches required branch/tag objects plus only the current pull-request ref, audits the checked-out `HEAD` ancestor graph, performs clean installs and inherited Phase 1/2 gates, executes Phase 3 tests and scan, runs the complete quality suite, and uploads only sanitized evidence.

## Verification sequence

```bash
node --check scripts/security/lib/secret-detectors.mjs
node --check scripts/security/lib/secret-scan.mjs
node --check scripts/security/lib/phase3-reproduction.mjs
node --check scripts/security/phase3-secret-scan.mjs
node --check scripts/security/phase3-reproduce.mjs
node --check Backend/Chatify/Utils/secretConfiguration.mjs
npm run security:phase3:test
npm --prefix Backend/Chatify test -- --run test/security/secret-configuration.test.mjs
npm run security:phase3:generate
npm run security:phase3:check
npm run security:phase3:reproduce
```

## Exit criteria

- Current tree and every eligible history blob reachable from the audited `HEAD` are scanned.
- Generated evidence contains no discovered value or value hash.
- Deleted historical credentials are discoverable with sanitized commit metadata.
- Allowlist exceptions are exact, accountable, and expiring.
- No unsuppressed candidate remains.
- Secret configuration fails before runtime imports when unsafe.
- JWT, CSRF, reset, and 2FA purposes are not silently collapsed into one key, and low-entropy key material is rejected.
- Credential response steps are committed and tested by the Phase 3 gate.
- CI makes required ancestor objects available, audits only the checked-out branch or pull-request merge `HEAD`, uses read-only repository permissions and pinned action revisions, and uploads sanitized artifacts.
