# Runbook: Incident Triage

**Owner:** Chatify maintainer | **Frequency:** During incidents
**Last Updated:** 2026-06-17 | **Last Run:** Not recorded

## Purpose

Diagnose production failures using readiness, structured logs, and known smoke gates without leaking private data.

## Prerequisites

- Access to hosting logs and deployment metadata.
- Production backend URL.
- Ability to run local npm scripts.

## Procedure

### Step 1: Capture Current Status

```powershell
Invoke-RestMethod "$env:CHATIFY_PROD_BACKEND_URL/api/health"
Invoke-RestMethod "$env:CHATIFY_PROD_BACKEND_URL/api/ready"
```

**Expected result:** Status identifies alive, degraded, or blocked components.
**If it fails:** Treat backend availability as the first incident layer.

### Step 2: Inspect Structured Logs

Search for event names such as:

```text
http.request.error
database.connection_error
queue.heavy_route_failed
socket.user_chats_load_failed
message.socket_emit_failed
call.timeout_failed
```

**Expected result:** Logs include event, timestamp, level, requestId when available, and redacted error summaries.
**If it fails:** Do not add temporary payload logging; add structured fields that remain safe.

### Step 3: Classify The Layer

| Signal | Layer |
|---|---|
| `/api/ready` database blocked | Database or connection string |
| `/api/ready` calls blocked | TURN or call provider config |
| HTTP 401/403 spikes | Auth, cookies, CORS, CSRF |
| `message.socket_emit_failed` | Socket initialization or room delivery |
| Production smoke duplicate messages | Delivery idempotency or cache merge |

## Verification

- Incident notes include event names, component statuses, timestamps, deploy ids, and sanitized artifact paths.
- Incident notes exclude message bodies, passwords, cookies, tokens, reset codes, SDP, ICE candidates, raw emails, and database URLs.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Logs lack request ids | Request did not pass through Express middleware | Check edge/proxy routing and backend app mount |
| Readiness is ok but smoke fails | Product workflow regression | Use Playwright trace and first failed step |
| Logs contain sensitive values | Logging regression | Stop adding evidence, rotate exposed credentials, and fix logger call site |

## Rollback

If a recent deployment correlates with the incident and no quick config fix exists, use `rollback.md`.

## Escalation

| Situation | Contact | Method |
|---|---|---|
| User privacy may be affected | Project maintainer | Escalate immediately and rotate affected credentials |

