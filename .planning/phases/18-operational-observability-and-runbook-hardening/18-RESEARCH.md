---
phase: 18-operational-observability-and-runbook-hardening
artifact: research
status: complete
created_at: 2026-06-17T10:33:18+03:00
---

# Phase 18 Research

## Observability Findings

- The most useful near-term signal is not a full metrics stack. Chatify needs structured log events at request, auth, queue, database, socket, message emit, storage, and call failure boundaries.
- A small logger utility can standardize event shape and redaction without adding a dependency.
- The logger should accept metadata objects, recursively redact risky key names, summarize errors, and avoid logging raw request bodies or socket payloads.
- Request ids should be accepted from `X-Request-Id` when safe, generated when missing, attached to `req.requestId`, and returned in an `X-Request-Id` response header.
- Socket-level correlation can use `socket.id` plus authenticated user id only where that id is already a normal internal identifier. It must not log cookies or handshake auth headers.

## Readiness Findings

- `/api/health` should be a cheap liveness endpoint that reports the process is up.
- `/api/ready` should report database connection state, required environment variable presence, frontend origin/cookie posture, queue status, socket initialization state, storage readiness, and TURN readiness.
- Production readiness should fail closed when required production env is missing.
- TURN readiness should be explicit: missing TURN can be degraded in development and blocked in production.
- Storage readiness can be checked by MongoDB connection availability because attachment/profile storage use GridFS over the same Mongoose connection.

## Runbook Findings

- Existing phase artifacts contain exact smoke env names, but operators need a stable place under versioned docs for startup, deployment verification, smoke setup, incident triage, rollback, and credential rotation.
- Runbooks should avoid copying real hosts or account names except public deploy origins already present in code/config. Prefer placeholders for smoke users and secrets.
- Rollback procedures should start with evidence capture, then use provider rollback or git revert, then re-run readiness/smoke checks.

## Validation Architecture

- Backend tests should cover logger redaction and readiness endpoints.
- Scripted guards should scan touched operational docs and logger tests for forbidden secret-shaped values and required env names.
- The final evidence artifact should record exact commands and blocked production prerequisites without implying launch readiness.

## Recommendation

Build the logger and readiness module with zero new runtime dependencies. The project already has enough testing infrastructure to validate this with Vitest and Supertest.
