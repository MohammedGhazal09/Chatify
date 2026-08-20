# Runbook: CI Quality Gates

**Owner:** Chatify maintainer | **Frequency:** Every pull request and push to protected branches
**Last Updated:** 2026-06-19 | **Last Run:** See GitHub Actions

## Purpose

Keep GitHub Actions aligned with local release work so a green pull request means the same core checks passed locally: backend tests, frontend tests, lint, build, operations checks, dependency security, and smoke configuration guardrails.

## Prerequisites

- Backend dependencies are locked in `Backend/Chatify/package-lock.json`.
- Frontend dependencies are locked in `Frontend/Chatify/package-lock.json`.
- GitHub Actions has permission to read repository contents.
- Production smoke secrets are configured only for release contexts that intentionally require live evidence.

## Procedure

### Pull Request And Normal Push Gate

The workflow `.github/workflows/security-and-test-foundation.yml` runs:

1. Backend install, high-severity production dependency audit, and backend tests.
2. Frontend install, high-severity production dependency audit, Vitest, lint, and build.
3. Root operations guard with `npm run ops:check`.
4. Phase 25 evidence generation with `npm run evidence:production`.
5. Production smoke config Playwright gate.
6. Required quality aggregate job.

Phase 25 is currently closed by maintainer-confirmed prior evidence. Fresh evidence may still be blocked on ordinary pull requests when live smoke secrets are intentionally absent, so the workflow uploads the evidence artifact and emits a warning instead of hiding the missing secret context.

### Release Gate

For release branches or protected deployment workflows, set repository variable:

```text
CHATIFY_CI_REQUIRE_PRODUCTION_EVIDENCE=1
```

When that variable is set, `npm run evidence:production` becomes blocking. It must pass with configured production origins, disposable smoke accounts, local smoke accounts, profile-image acceptance env, and TURN provider env before a fresh release-candidate readiness claim.

## Verification

Local equivalents:

```powershell
npm --prefix Backend/Chatify audit --omit=dev --audit-level=high
npm --prefix Backend/Chatify test -- --run
npm --prefix Frontend/Chatify audit --omit=dev --audit-level=high
npm --prefix Frontend/Chatify test -- --run
npm --prefix Frontend/Chatify run lint
npm --prefix Frontend/Chatify run build
npm --prefix Frontend/Chatify run test:e2e:prod -- e2e/production-smoke-config.spec.ts --workers=1
npm run ops:check
npm run evidence:production
```

Expected local result without smoke secrets: all checks pass except `npm run evidence:production`, which exits nonzero because it cannot refresh the user-confirmed historical closure without the live smoke/TURN environment.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Frontend audit fails high | Runtime dependency advisory | Run a non-force `npm audit fix` in `Frontend/Chatify`, then rerun tests/lint/build. |
| Production evidence fails on PR | Live smoke secrets are absent | Expected for ordinary PRs; inspect the uploaded Phase 25 evidence artifact. |
| Production evidence fails on release | Required smoke/TURN env is missing or invalid | Configure disposable accounts, origins, local smoke env, and TURN provider variables, then rerun. |
| Browser smoke config fails | Production config regression | Inspect `Frontend/Chatify/e2e/production-smoke-config.spec.ts` failure and Vercel rewrite/env handling. |

## Security Notes

- CI must not print raw smoke account emails, passwords, cookies, tokens, reset codes, SDP, ICE candidates, or TURN credentials.
- Dependency audits block high severity production dependency advisories by default.
- The remaining low-severity frontend dev-server advisory is visible in audit output but not release-blocking under the high-severity threshold.
