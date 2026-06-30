# Hercules Visual QA: Phases 42-49

Generated: 2026-06-30T22:05:00+03:00

## Overall Status

Passed with fixes for Chatify Phase 42-49 deterministic browser QA.

The initial QA used the Hercules skill's Playwright fallback path, with deterministic browser evidence and screenshots. After explicit user approval for subagents, an independent subagent reran the same Phase 42-49 browser suite and produced a second screenshot set with the same pass result.

The local TestZeus Hercules generic wrapper was also attempted. It verified the QA report and screenshot artifacts, but its live browser visit failed because `http://127.0.0.1:4177` was unreachable at wrapper time. That wrapper result is recorded as failed/blocked for live URL evidence, not as a passed Hercules browser run.

## Scope Tested

- Local app URL: `http://127.0.0.1:4177`
- Browser: Playwright Chromium using configured Chrome channel
- Source: `D:\Projects\Chatify`
- Branch/commit: `main` at `197299f`
- Test data: mocked local `.invalid` / `.test` fixture users, fake invite URL, no production data
- Artifact root: `.planning/phases/42-49-hercules-visual-qa`
- Subagent artifact root: `.planning/phases/42-49-hercules-visual-qa-subagent`
- TestZeus wrapper proof root: `C:\Users\saieh\Tools\testzeus-hercules\opt\proofs\storeseller\chatify_phase42_49_20260630_215643`

## Findings

### Fixed: Phase 45 MFA Back Flow Could Reopen Challenge / Emit React Warnings

- Severity: Medium
- Route/state: `/login`, MFA challenge after password login
- Viewport: 1366x768
- Expected: "Back to sign in" returns to the password form without console errors.
- Actual: Browser QA reproduced the challenge remaining visible during the back flow, and DOM-level confirmation exposed React controlled/uncontrolled input warnings.
- Evidence: `screenshots/phase45-desktop-two-factor-challenge.png`, `screenshots/phase45-desktop-back-to-sign-in.png`
- Root cause: MFA challenge state could be overwritten by stale login challenge callbacks, and React reused input nodes between the password and MFA forms.
- Fix: Versioned MFA view state and keyed alternate forms in `Frontend/Chatify/src/pages/login/login.tsx`.
- Status: Fixed and verified by Playwright, Vitest, lint, and build.

### Fixed: Phase 43 Backend Test Expectation Drift

- Severity: Low
- Area: Backend message reply idempotency test
- Expected: Test accepts the current conflict message.
- Actual: Test still expected the pre-mentions conflict wording.
- Fix: Updated `Backend/Chatify/test/message/message.replies.test.mjs` to include mentions in the expected conflict reason.
- Status: Fixed and verified by focused backend suite.

## Coverage Ledger

| Area | Route/state | Control/workflow/scenario | Expected | Evidence | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Phase 42 | `/`, empty chat | Contact request queue, cancel outgoing, send request, accept incoming | Requests are actionable and accepted chat opens | `phase42-desktop-contact-requests.png`, `phase42-desktop-request-sent.png`, `phase42-desktop-accepted-chat.png` | tested | Desktop logic + visual |
| Phase 42 | `/`, mobile empty chat | Contact requests modal responsive layout | Modal fits 390px viewport | `phase42-mobile-contact-requests.png` | tested | No horizontal overflow observed |
| Phase 43 | `/?chatId=phase06-chat-in-8b21` | Message action reply preview | Composer shows quoted context | `phase43-desktop-reply-preview.png` | tested | Backend reply tests also passed |
| Phase 44 | chat switch | Per-conversation draft persist/restore | Draft appears in sidebar and restores when chat returns | `phase44-desktop-draft-sidebar.png`, `phase44-desktop-draft-restored.png` | tested | Frontend suite passed |
| Phase 45 | `/login` | MFA challenge, disabled/enabled Verify, back to sign in | Challenge is clear and back returns to password form | `phase45-desktop-two-factor-challenge.png`, `phase45-desktop-back-to-sign-in.png` | fixed | Fixed stale challenge/input warning issue |
| Phase 46 | group chat | Mention suggestions and selection | `@pr` suggests PR-0E6F and inserts username | `phase46-desktop-mention-suggestions.png` | tested | Backend mention tests passed |
| Phase 47 | group chat admin | Invite link dialog, create link, revoke confirmation | Manageable links render and create/revoke flow starts | `phase47-desktop-invite-links.png`, `phase47-desktop-created-invite-link.png`, `phase47-desktop-revoke-confirmation.png` | tested | Fake redacted URL only |
| Phase 48 | saved messages | Saved dialog, encrypted saved item, jump/save actions | Saved plaintext shown only where allowed; encrypted plaintext hidden | `phase48-desktop-saved-dialog.png`, `phase48-mobile-saved-dialog.png` | tested | Existing e2e passed |
| Phase 49 | admin delivery health | Desktop metrics, 7-day switch, refresh | Dashboard data changes by window | `phase49-desktop-delivery-health.png`, `phase49-desktop-window-7d.png` | tested | Existing e2e passed |
| Phase 49 | admin delivery health | Mobile, RTL tablet empty, non-admin, backend error | Responsive, localized, permission, and error states render | `phase49-mobile-delivery-health.png`, `phase49-tablet-rtl-empty.png`, `phase49-non-admin.png`, `phase49-error.png` | tested | Existing e2e passed |
| Hercules wrapper | `http://127.0.0.1:4177` | Generic TestZeus wrapper live browser visit | Wrapper opens app and records identity evidence | `C:\Users\saieh\Tools\testzeus-hercules\opt\output\storeseller-codex-brain-result.txt` | blocked | Port was unreachable during wrapper run; artifact-file checks completed |

## Visual Evidence

Screenshot count: 23 files under `.planning/phases/42-49-hercules-visual-qa/screenshots`.

Independent subagent screenshot count: 23 files under `.planning/phases/42-49-hercules-visual-qa-subagent/screenshots`.

Reviewed representative screenshots:

- `phase42-desktop-contact-requests.png`
- `phase42-mobile-contact-requests.png`
- `phase43-desktop-reply-preview.png`
- `phase44-desktop-draft-restored.png`
- `phase45-desktop-two-factor-challenge.png`
- `phase45-desktop-back-to-sign-in.png`
- `phase46-desktop-mention-suggestions.png`
- `phase47-desktop-created-invite-link.png`
- `phase48-mobile-saved-dialog.png`
- `phase49-desktop-delivery-health.png`
- `phase49-tablet-rtl-empty.png`

No unresolved visual overlap, clipping, horizontal overflow, inaccessible unnamed primary controls, or exposed encrypted saved-message plaintext was observed in the reviewed surfaces.

## Hercules Wrapper Evidence

- `check-hercules.ps1`: exited with `-1` and no useful output.
- `run-storeseller-codex-brain.ps1` under Windows PowerShell: failed immediately because `[System.IO.Path]::GetRelativePath` is unavailable in Windows PowerShell.
- `run-storeseller-codex-brain.ps1` under PowerShell 7.6.1: produced `storeseller-codex-brain-result.txt` with status `failed`.
- Wrapper artifact assertions that passed: feature file found, Chatify repo found, QA report contained `Passed with fixes`, report referenced Phase 42 and Phase 49, and exactly 23 screenshot files were found.
- Wrapper browser evidence that failed: `Page.goto` to `http://127.0.0.1:4177/` returned `net::ERR_CONNECTION_REFUSED`; no live page title, final URL, console, or network evidence was collected by that wrapper.
- Wrapper proof files: `feature.txt`, `HERCULES-VISUAL-QA.copy.md`, `chatify-screenshot-files.json`, `browser-identity.json`, `trace.zip`.

## Commands And Results

- `npx playwright test e2e/chat-phase42-47-visual-qa.spec.ts e2e/chat-saved-messages.spec.ts e2e/admin-delivery-health.spec.ts`: 12 passed.
- Subagent rerun of the same command with `HERCULES_ARTIFACT_DIR=.planning/phases/42-49-hercules-visual-qa-subagent`: 12 passed, 23 screenshots.
- Backend focused phase suite: 7 files, 31 tests passed.
- Frontend Vitest: 68 files, 430 tests passed.
- `npm run lint` from `Frontend/Chatify`: passed.
- `npm run build` from `Frontend/Chatify`: passed.
- Full backend Vitest: reported 64 files and 310 tests passed, but the command timed out after 360s before process exit.
- `run-storeseller-codex-brain.ps1` with `chatify-phase42-49.feature`: failed/blocked on live URL evidence because port `4177` was unreachable; artifact checks passed.

## Files Changed By This QA Pass

- `Frontend/Chatify/e2e/chat-phase42-47-visual-qa.spec.ts`
- `Frontend/Chatify/src/pages/login/login.tsx`
- `Backend/Chatify/test/message/message.replies.test.mjs`
- `.planning/phases/42-49-hercules-visual-qa/HERCULES-VISUAL-QA.md`
- `.planning/phases/42-49-hercules-visual-qa/chatify-phase42-49.feature`
- `.planning/phases/42-49-hercules-visual-qa/screenshots/*`
- `.planning/phases/42-49-hercules-visual-qa-subagent/screenshots/*`

## Remaining Risks And Recommendations

- Full backend test command still needs runner/runtime cleanup because it times out after reporting all tests passed. Recommendation: inspect open handles in backend Vitest setup/teardown.
- Generic TestZeus wrapper live browser evidence is blocked unless the Chatify preview server is guaranteed alive for the wrapper duration. Recommendation: use a wrapper that starts/stops `npm run preview -- --port 4177` itself, then rerun the same feature.
- Phase 42 decline action was verified by component/focused coverage and visible in e2e, while integrated e2e clicked cancel and accept. Recommendation: add one small integrated decline-path e2e later if contact-request regressions continue.
