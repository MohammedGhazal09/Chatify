# Runbook: Local Startup

**Owner:** Chatify maintainer | **Frequency:** As needed
**Last Updated:** 2026-06-17 | **Last Run:** Not recorded

## Purpose

Start Chatify locally with the backend, frontend, database, cookies, sockets, and readiness endpoints aligned.

## Prerequisites

- Node.js and npm are installed.
- MongoDB is available locally or through a disposable development connection.
- `Backend/Chatify/.env` exists with sanitized values based on `Backend/Chatify/.env.example`.
- `Frontend/Chatify/.env` exists with values based on `Frontend/Chatify/.env.example`.

## Procedure

### Step 1: Install Dependencies

```powershell
npm --prefix Backend/Chatify install
npm --prefix Frontend/Chatify install
```

**Expected result:** Both package installs complete without audit-blocking install errors.
**If it fails:** Re-run the failing package install and inspect the package-specific npm error.

### Step 2: Start Backend

```powershell
cd Backend/Chatify
npm start
```

**Expected result:** Backend starts on `PORT` or `PORT_NUMBER`, then logs structured database and HTTP events.
**If it fails:** Check `MONGODB_URL`, `SECRET_JWT_KEY`, `PASSWORD_RESET_SECRET`, and local MongoDB availability.

### Step 3: Start Frontend

```powershell
cd Frontend/Chatify
npm run dev
```

**Expected result:** Vite serves the app, usually at `http://localhost:5173`.
**If it fails:** Verify `VITE_BACKEND_URL` points to the backend and no other Vite process owns the port.

### Step 4: Check Readiness

```powershell
Invoke-RestMethod http://localhost:5000/api/health
Invoke-RestMethod http://localhost:5000/api/ready
```

**Expected result:** `/api/health` returns `status: ok`; `/api/ready` reports component statuses without secrets.
**If it fails:** Use the blocked component name, not guesswork, to choose the next fix.

## Verification

- `npm run quality` passes from the repo root.
- `/api/ready` does not print database URLs, tokens, cookies, or TURN credentials.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Backend cannot connect to MongoDB | `MONGODB_URL` is wrong or MongoDB is down | Start MongoDB or replace the local URI with a disposable development URI |
| Browser requests fail with CORS | Frontend origin env mismatch | Set `FRONTEND_ORIGIN_DEV=http://localhost:5173` and restart backend |
| Socket connects but calls are degraded | TURN is not configured locally | Accept degraded local status or configure placeholder TURN env for testing |

## Rollback

Stop both dev servers. Revert local `.env` edits manually if they were experimental and not needed.

## Escalation

| Situation | Contact | Method |
|---|---|---|
| Local setup blocks all work | Project maintainer | Current Codex thread or issue tracker |

