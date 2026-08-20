# Phase 47 Verification

## Automated Checks

- Backend focused tests:
  - Command: `cd Backend/Chatify; npm test -- test/invite/invite-links.test.mjs test/chat/chat.group.test.mjs test/space/space.messaging.test.mjs`
  - Result: passed, 3 files, 14 tests.
- Frontend focused tests:
  - Command: `cd Frontend/Chatify; npm test -- --run src/pages/chat/components/InviteLinksDialog.test.tsx src/pages/chat/components/ConversationMoreMenu.test.tsx`
  - Result: passed, 2 files, 13 tests.
- Frontend lint:
  - Command: `cd Frontend/Chatify; npm run lint`
  - Result: passed.
- Frontend build/typecheck:
  - Command: `cd Frontend/Chatify; npm run build`
  - Result: passed.
- Phase-scoped diff check:
  - Command: `git diff --check -- <phase 47 files>`
  - Result: passed; line-ending warnings only.

## Browser QA

- Mode: fallback Playwright visual QA using the Hercules visual QA artifact contract.
- Script: `.planning/phases/47-expiring-and-revokable-invite-links/phase47-visual-qa.mjs`
- Artifact root: `C:\Users\saieh\.agents\artifacts\hercules-visual-qa\20260630-092800-phase47-invite-links-127.0.0.1-5179`
- Result: passed.
- Covered:
  - Desktop group admin invite list/create/copy/revoke confirmation/revoked state.
  - Direct chat boundary with no invite menu item.
  - Mobile group invite dialog layout and overflow checks.
  - Tablet space manager invite creation layout and overflow checks.
  - Protected group invite join redirect.
  - Protected space invite join redirect.
- Network evidence:
  - Unknown API requests: 0.
  - Unexpected network failures: 0.
  - Expected socket failures: 6, because the QA harness mocks HTTP APIs and does not run Socket.IO.

## Notes

- Invite URLs in browser artifacts use redacted test tokens only.
- No production credentials, cookies, or real invite tokens are recorded in planning docs.
