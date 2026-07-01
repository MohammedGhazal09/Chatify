---
phase: 54
name: Bot And Integration Permission Runtime
status: completed
depends_on: [53]
created: 2026-07-01
---

# Phase 54: Bot And Integration Permission Runtime

## Goal

Implement the minimum safe integration runtime foundation: app registration, scoped target installation, revocation, token rotation, token-authenticated runtime identity, aggregate admin visibility, and audit evidence. This phase does not execute arbitrary bot code or allow integrations to post messages.

## Requirements

- Support app registration owned by an authenticated user.
- Support explicit allowed scopes from a fixed allowlist.
- Support per-space or per-group installation by authorized owners/admins only.
- Store runtime tokens hashed and return plaintext tokens only on install/rotation.
- Support revocation that immediately blocks runtime token access.
- Record audit logs for app creation, installation, token rotation, revocation, runtime access, and denied runtime access.
- Expose a token-authenticated runtime manifest endpoint that returns only the integration identity, target, status, and granted scopes.
- Expose admin-only aggregate integration diagnostics.
- Add admin UI visibility without adding a marketplace or execution surface.

## Non-Goals

- No arbitrary bot code execution.
- No message read/write runtime endpoints.
- No public app directory.
- No third-party OAuth consent flow.
- No webhook delivery worker.

## Acceptance Criteria

- Integrations cannot install outside authorized spaces/group conversations.
- Runtime tokens cannot be recovered from storage and old tokens stop working after rotation/revocation.
- Scope requests outside the app allowlist or platform allowlist are rejected.
- Runtime manifest access is audited and privacy-safe.
- Admin diagnostics are aggregate-only and localized.
- Backend, frontend, lint/build, and Hercules-compatible visual QA evidence are recorded.
