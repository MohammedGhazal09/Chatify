---
phase: 18-operational-observability-and-runbook-hardening
artifact: context
status: complete
created_at: 2026-06-17T10:33:18+03:00
source: inline continuation from roadmap and current repo evidence
---

# Phase 18 Context

## Locked Decisions

- D-01: Phase 18 is an operations/supportability phase, not a release-readiness bypass.
- D-02: Logs must be structured and redacted by default; tokens, cookies, reset codes, OAuth payloads, SDP, ICE candidates, private message text, passwords, raw emails, and file internals must not be logged.
- D-03: Operational logs should record decisions and failures, not every low-value activity.
- D-04: Request logs must carry a request id that downstream handlers can reuse.
- D-05: Socket logs must avoid raw socket payloads and WebRTC signal contents; event names, codes, and safe ids are enough.
- D-06: Health and readiness routes must be safe to call without authentication and must not reveal secrets.
- D-07: Readiness may return degraded or blocked when optional production prerequisites such as TURN are missing.
- D-08: Root quality scripts must be Windows-friendly and use existing backend/frontend npm commands instead of shell-specific chains.
- D-09: Runbooks must be operator-facing and use placeholders for every credential or production account.
- D-10: Phase 18 must preserve all Phase 14, Phase 15, and Phase 17 blockers as blocked until their real smoke env is supplied.
- D-11: Preserve unrelated dirty work and do not edit `Frontend/Chatify/src/pages/chat/chat.tsx`.
- D-12: Execution must remain inline in this Codex thread; do not use subagents.

## Canonical Inputs

- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/REQUIREMENTS.md`
- `.planning/phases/17-v1-readiness-closure-and-release-gate/17-V1-READINESS.md`
- `Backend/Chatify/app.mjs`
- `Backend/Chatify/Middlewares/requestLogger.mjs`
- `Backend/Chatify/Middlewares/queueMiddleware.mjs`
- `Backend/Chatify/Utils/requestQueue.mjs`
- `Backend/Chatify/Config/DBConfig.mjs`
- `Backend/Chatify/Config/socket.mjs`
- `Backend/Chatify/Utils/callIceConfig.mjs`
- `Backend/Chatify/.env.example`
- `Frontend/Chatify/.env.example`
- `package.json`
- `Backend/Chatify/package.json`
- `Frontend/Chatify/package.json`

## Current Evidence

- `gsd-tools query verify phase-completeness 17` passed with 4 plans and 4 summaries.
- `gsd-tools query progress` shows Phase 18 has 0 plans and 0 summaries before this planning step.
- Root `package.json` still contains only the placeholder failing `test` script.
- Backend `.env.example` documents `CALL_TURN_URLS`, `CALL_TURN_USERNAME`, and `CALL_TURN_CREDENTIAL`.
- Frontend `.env.example` documents `VITE_BACKEND_URL` and `VITE_SOCKET_URL`.
- Backend request logging generates `req.requestId`, but output is not consistently structured or mounted in production.
- Backend queue status exists at `/api/queue-status`; consolidated health/readiness does not exist.

## Recommendation

Default to a conservative operational result: Phase 18 can pass local operations hardening, but it must continue to report release readiness as blocked until production smoke and TURN evidence are actually configured.
