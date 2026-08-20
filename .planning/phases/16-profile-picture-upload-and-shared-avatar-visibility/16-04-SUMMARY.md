---
phase: 16-profile-picture-upload-and-shared-avatar-visibility
plan: 16-04
subsystem: acceptance-and-regression
tags: [playwright, acceptance, privacy-scan, regression, generated-images, evidence]
requires:
  - plan: 16-01
    provides: backend profile image contract and tests
  - plan: 16-02
    provides: Settings workflow and mutation tests
  - plan: 16-03
    provides: avatar rendering and fixture guard tests
provides:
  - Opt-in local two-account Playwright acceptance gate for profile picture upload and cross-user visibility
  - Runtime-generated PNG profile image fixture for Playwright acceptance
  - Redacted Phase 16 acceptance evidence artifact
  - Full backend/frontend regression gate evidence
  - Privacy and fixture scan evidence with blocked local E2E prerequisites documented
affects: [acceptance, e2e, phase-evidence, profile-image, privacy-scan]
tech-stack:
  added: []
  patterns:
    - Opt-in local acceptance env contract that skips/blocks instead of false-passing without setup
    - Redacted markdown evidence artifact for profile image acceptance
    - Runtime-generated image fixture files under Playwright test-results
key-files:
  created:
    - Frontend/Chatify/e2e/pages/profilePictureAcceptance.ts
    - Frontend/Chatify/e2e/profile-picture.spec.ts
    - .planning/phases/16-profile-picture-upload-and-shared-avatar-visibility/16-PROFILE-IMAGE-ACCEPTANCE.md
  modified: []
key-decisions:
  - "The local two-account Playwright flow is opt-in and requires explicit backend/account environment variables."
  - "Generated accounts are not used for profile image acceptance to avoid polluting persistent local databases."
  - "Missing local acceptance setup is recorded as blocked/skipped, not as product pass or product failure."
  - "The acceptance report states local scope only and does not claim production readiness."
patterns-established:
  - "Phase 16 local acceptance uses CHATIFY_LOCAL_PROFILE_IMAGE_ACCEPTANCE=1 as the opt-in flag."
  - "VITE_BACKEND_URL must match CHATIFY_LOCAL_BACKEND_URL so the Vite-served frontend talks to the intended backend."
  - "Generated profile image files are created at runtime, not committed as static avatar fixtures."
requirements-addressed:
  - ID-01
  - ID-02
  - SEC-01
  - SEC-02
  - TEST-01
  - TEST-04
  - TEST-05
  - UI-04
  - UI-05
  - UI-06
  - SPEC-16-01
  - SPEC-16-02
  - SPEC-16-03
  - SPEC-16-04
  - SPEC-16-05
  - SPEC-16-06
  - SPEC-16-07
  - SPEC-16-08
  - SPEC-16-09
duration: 12 min
completed: 2026-06-16
---

# Phase 16 Plan 16-04: Acceptance Evidence, Privacy Scan, And Regression Gate Summary

**Phase 16 now has a regression-backed acceptance artifact and an opt-in local two-account Playwright gate. The final browser cross-user proof is blocked until local backend/account env is provided.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-16T05:17:05Z
- **Completed:** 2026-06-16T05:23:00Z
- **Tasks:** 4
- **Files modified:** 3

## Accomplishments

- Added a Phase 16 Playwright profile-picture spec that uploads a generated PNG through Settings and verifies another authenticated browser context sees an app-served profile image after normal refresh.
- Added a profile-picture acceptance helper with redacted env validation, runtime-generated image fixture creation, and markdown report writing.
- Wrote `16-PROFILE-IMAGE-ACCEPTANCE.md` mapping each SPEC-16 requirement to concrete evidence and documenting the local two-account blocker.
- Ran backend and frontend focused tests, frontend lint, frontend build, local Playwright setup gate, and privacy/fixture scans.

## Task Commits

1. **Tasks 16-04-T1 through 16-04-T4: Playwright acceptance gate, redacted evidence artifact, regression gate, and privacy scans** - `e14714d` (test)

**Plan metadata:** this summary commit.

## Files Created/Modified

- `Frontend/Chatify/e2e/pages/profilePictureAcceptance.ts` - Phase 16 local acceptance config, generated image fixture, and redacted report helper.
- `Frontend/Chatify/e2e/profile-picture.spec.ts` - Opt-in two-account profile-picture Playwright flow.
- `.planning/phases/16-profile-picture-upload-and-shared-avatar-visibility/16-PROFILE-IMAGE-ACCEPTANCE.md` - Final evidence matrix and blocker report.

## Decisions Made

- The local two-account browser proof is intentionally blocked unless `CHATIFY_LOCAL_PROFILE_IMAGE_ACCEPTANCE=1`, matching backend URL config, and two existing local accounts are configured.
- The acceptance gate uses runtime-generated image bytes in Playwright `test-results`, avoiding committed static avatar/image fixtures.
- The final artifact is honest about the blocked local browser proof while preserving all passed backend/frontend evidence.

## Deviations from Plan

- Replace/remove coverage remains in backend and frontend focused tests instead of the blocked browser flow because the browser flow could not run without local env/accounts.

## Issues Encountered

- The first acceptance commit had one markdown EOF whitespace warning. It was fixed and the commit was amended before continuing.
- The broad privacy scan is intentionally noisy because it includes backend internals, tests, package lockfiles, and planning docs. A narrower runtime-client scan was run to confirm no profile-image storage internals or static demo avatar fixture content shipped in frontend runtime components.

## Verification

```powershell
cd Backend/Chatify
npm test -- --run test/user/user.profile-image.test.mjs test/message/message.attachments.test.mjs test/message/message.attachment-authorization.test.mjs
```

Result: passed, 3 test files, 19 tests.

```powershell
cd Frontend/Chatify
npm test -- --run src/components/SettingsModal.test.tsx src/hooks/useProfileImageMutation.test.tsx src/pages/chat/components/UserAvatar.test.tsx src/pages/chat/components/ConversationHeader.test.tsx src/pages/chat/components/ConversationDetailContent.test.tsx src/pages/chat/components/ChatListItem.test.tsx src/pages/chat/components/NewChatDialog.test.tsx src/pages/chat/fixtureLeakGuard.test.ts
```

Result: passed, 8 test files, 26 tests.

```powershell
cd Frontend/Chatify
npm run test:ui -- --grep "Phase 16"
```

Result: 2 skipped as designed; local backend/account env was not configured, and the blocked acceptance artifact was written.

```powershell
cd Frontend/Chatify
npm run lint
npm run build
```

Result: both passed.

```powershell
rg -n "gridfs|storageFileId|objectKey|sha256|raw hash|private path|cookie|token|demo avatar|fixture avatar|profile photo fixture" Backend/Chatify Frontend/Chatify/src .planning/phases/16-profile-picture-upload-and-shared-avatar-visibility
```

Result: broad scan reported expected backend internals, auth/CSRF implementation terms, tests, lockfiles, and planning text.

```powershell
rg -n "gridfs|storageFileId|objectKey|sha256|raw hash|private path|cookie|token|demo avatar|fixture avatar|profile photo fixture" Frontend/Chatify/src --glob '!**/*.test.*' --glob '!**/*.spec.*'
```

Result: no profile-image storage internals or static demo-avatar fixture content in runtime chat components; remaining hits are existing auth/CSRF API implementation terms and a CSS comment containing the word "tokens".

## User Setup Required

To run the local two-account browser proof:

- `CHATIFY_LOCAL_PROFILE_IMAGE_ACCEPTANCE=1`
- `CHATIFY_LOCAL_BACKEND_URL`
- `VITE_BACKEND_URL` matching `CHATIFY_LOCAL_BACKEND_URL`
- `CHATIFY_LOCAL_USER_A_EMAIL`
- `CHATIFY_LOCAL_USER_A_PASSWORD`
- `CHATIFY_LOCAL_USER_B_EMAIL`
- `CHATIFY_LOCAL_USER_B_PASSWORD`
- Optional for non-loopback backend targets: `CHATIFY_ALLOW_NONLOCAL_PROFILE_IMAGE_ACCEPTANCE=1`

## Next Phase Readiness

Phase 16 implementation is complete. The only blocked evidence is the final local two-account browser proof, which can be rerun with the env above using:

```powershell
cd Frontend/Chatify
npm run test:ui -- --grep "Phase 16"
```

---
*Phase: 16-profile-picture-upload-and-shared-avatar-visibility*
*Completed: 2026-06-16*
