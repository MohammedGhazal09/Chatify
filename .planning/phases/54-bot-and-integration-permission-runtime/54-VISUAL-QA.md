# Phase 54 Visual QA

## Runner

Hercules-compatible Playwright fallback was used. The local Hercules checkout exists, but the available runner scripts are smoke-oriented or spawn nested Codex execution, so deterministic project Playwright was used to avoid extra agent usage.

## Command

`$env:HERCULES_ARTIFACT_DIR='D:\Projects\Chatify\.planning\phases\54-bot-and-integration-permission-runtime\visual-qa'; npx playwright test e2e/admin-integrations.spec.ts e2e/admin-hub.spec.ts --config=playwright.config.ts` from `Frontend/Chatify`

## Result

Passed: 10 tests.

## Identity Evidence

- Source repo: `D:\Projects\Chatify`
- Branch/base commit during QA: `main` at `96f2cb1`, with Phase 54 worktree changes applied.
- Browser: Playwright Chrome channel.
- Local app URL: `http://127.0.0.1:4177`
- Routes tested: `/admin/integrations?chatTheme=light`, `/admin?chatTheme=light`
- Test identity: mocked admin and non-admin users through Playwright route fixtures.
- Backend data: mocked aggregate diagnostics; no production services or destructive actions used.

## Redaction Note

Screenshots use synthetic phase fixtures. Plaintext runtime tokens, token hashes, user emails, chat names, and message content were not present in the rendered diagnostics.

## Screenshots Reviewed

- `visual-qa/screenshots/phase54-integrations-desktop.png`
- `visual-qa/screenshots/phase54-integrations-mobile.png`
- `visual-qa/screenshots/phase54-integrations-rtl.png`
- `visual-qa/screenshots/phase54-integrations-error.png`
- `visual-qa/screenshots/phase54-integrations-non-admin.png`
- `visual-qa/screenshots/phase51-admin-hub-desktop.png`
- `visual-qa/screenshots/phase51-admin-hub-mobile.png`
- `visual-qa/screenshots/phase51-admin-hub-rtl.png`
- `visual-qa/screenshots/phase51-admin-hub-summary-error.png`
- `visual-qa/screenshots/phase51-admin-hub-non-admin.png`

## Findings

- Fixed: `/admin` desktop tool card layout became cramped after adding the fourth card. The grid now stays at two columns until very wide desktop.
- Fixed: `/admin` RTL/tablet snapshot cards were too narrow and labels truncated poorly. The snapshot grid now stays at two columns until wide desktop.
- No unresolved visual defects found on the integrations page.

## Coverage Ledger

| Area | Route/state | Control/workflow/scenario | Expected | Evidence | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Integrations page | `/admin/integrations`, desktop | Aggregate diagnostics render | Metrics, scopes, runtime, permission, and token boundary panels render without private data | `phase54-integrations-desktop.png` | tested | Console errors and non-socket failed requests were checked by Playwright |
| Integrations page | `/admin/integrations`, mobile | Responsive stacking | Cards and panels stack without clipping or overlap | `phase54-integrations-mobile.png` | tested | Full-page screenshot reviewed |
| Integrations page | `/admin/integrations`, RTL | Arabic labels and direction | Layout flips cleanly and text remains readable | `phase54-integrations-rtl.png` | tested | Full-page screenshot reviewed |
| Integrations page | `/admin/integrations`, non-admin | Permission boundary | Restricted state renders and diagnostics are not requested | `phase54-integrations-non-admin.png` | tested | No diagnostics leak |
| Integrations page | `/admin/integrations`, API failure | Error state and refresh action | Shell remains available and error copy is actionable | `phase54-integrations-error.png` | tested | Refresh button visible |
| Admin hub | `/admin`, desktop | Four admin tool cards | Moderation, delivery, privacy, and integrations cards remain readable | `phase51-admin-hub-desktop.png` | fixed | Initial screenshot found narrow cards; fixed and rerun |
| Admin hub | `/admin`, mobile | Four-card stack | Cards stack with readable actions and metrics | `phase51-admin-hub-mobile.png` | tested | Full-page screenshot reviewed |
| Admin hub | `/admin`, RTL/tablet | Snapshot and cards | Arabic labels fit without awkward truncation | `phase51-admin-hub-rtl.png` | fixed | Initial screenshot found cramped snapshot cards; fixed and rerun |
| Admin hub | `/admin`, non-admin | Permission boundary | Restricted state renders | `phase51-admin-hub-non-admin.png` | tested | No admin data shown |
| Admin hub | `/admin`, API failure | Tool links remain usable | Cards show unavailable state and links remain visible | `phase51-admin-hub-summary-error.png` | tested | Aggregate-only failure state |
