---
phase: 21
plan: 21-03
status: completed
completed_at: 2026-06-18
commit: 4f2cc6f
---

# 21-03 Summary: Regression And Email-Leak Guardrails

## Completed

- Added runtime fixture-leak guard patterns for the old email direct-chat contract:
  - `targetEmail`
  - `newChatEmail`
  - `new-chat-email`
  - `friend@example.com`
  - old email-based direct-chat copy and validation copy
- Confirmed username targeting remains allowed by the guard.
- Searched non-test backend/frontend chat-start surfaces for old email-start-chat terms.

## Verification

- `cd Frontend/Chatify; npm test -- --run src/pages/chat/components/NewChatDialog.test.tsx src/pages/chat/components/ChatSidebar.test.tsx src/pages/chat/fixtureLeakGuard.test.ts`
- Result: 3 files passed, 16 tests passed.
- `rg "targetEmail|newChatEmail|new-chat-email|friend@example|Check the email|valid email|exact email|direct chat by email" Backend\Chatify\Controller Backend\Chatify\Routes Frontend\Chatify\src\pages\chat Frontend\Chatify\src\hooks\useChatQueries.ts Frontend\Chatify\src\types\chat.ts -n --glob "!**/*.test.*"`
- Result: no matches.

## Notes

- Account email fields and login/signup/reset validation remain intentionally unchanged outside the chat discovery surface.
