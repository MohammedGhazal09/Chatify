---
phase: 18-operational-observability-and-runbook-hardening
artifact: spec
status: complete
created_at: 2026-06-17T10:33:18+03:00
---

# Phase 18 Spec

## Goal

Operators and maintainers can diagnose Chatify production behavior without leaking secrets, guessing at deployment state, or manually reconstructing test and rollback procedures.

## Current State

- Backend request logging exists in `Backend/Chatify/Middlewares/requestLogger.mjs`, but it writes string console output and only mounts outside production.
- Several backend paths still use direct `console.log` or `console.error` calls for database, queue, socket, chat, message, and call failures.
- The backend exposes `/api/queue-status`, but there is no consolidated health or readiness endpoint for database state, required environment variables, storage readiness, socket status, CORS/cookie expectations, or TURN readiness.
- Root `package.json` has a failing placeholder `test` script and no repeatable full quality gate.
- Frontend production smoke scripts already exist, but their environment contracts are spread across e2e helpers and phase artifacts.
- Runbook coverage exists in phase artifacts, but there is no operator-facing runbook set for local startup, deployment verification, smoke setup, incident triage, rollback, or credential rotation.

## Phase Scope

- Add structured, redacted backend diagnostics for operationally meaningful decisions and failures.
- Add health/readiness routes that are cheap, unauthenticated, and secret-safe.
- Add repeatable npm scripts at the root and package level for local quality and production smoke entry points.
- Add sanitized runbooks that describe exact commands, required environment variables, failure triage, rollback, and credential rotation.
- Add automated checks that fail on sensitive log regressions, missing required env documentation, and broken readiness endpoints.

## Out Of Scope

- No production readiness pass claim. Phase 14, Phase 15, and Phase 17 blockers still govern release readiness.
- No new chat, call, media, notification, or account UX features.
- No external observability vendor integration.
- No committed `.env` values, smoke credentials, tokens, cookies, reset codes, SDP, ICE candidates, emails, or private message text.
- No edits to `Frontend/Chatify/src/pages/chat/chat.tsx`.

## Acceptance Criteria

- Backend structured logs include stable event names, request ids or correlation ids, severity, and redacted metadata.
- Health/readiness responses expose component status without secrets and return a failing HTTP status when required production prerequisites are missing.
- Root and package scripts can run backend tests, frontend tests, frontend lint, frontend build, local e2e, and production smoke commands from PowerShell.
- Runbooks document local startup, deployment verification, production smoke setup, incident triage, rollback, and credential rotation with sanitized examples.
- Tests or scripted guards fail when sensitive fields appear in logger output, required env docs drift, or readiness routes stop reporting expected components.

## Recommendation

Implement Phase 18 as four sequential plans: diagnostics first, readiness second, scripts/runbooks third, and regression evidence last. This avoids documenting procedures that do not match the actual runtime surfaces.
