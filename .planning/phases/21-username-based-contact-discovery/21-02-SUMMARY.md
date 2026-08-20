---
phase: 21
plan: 21-02
status: completed
completed_at: 2026-06-18
commit: 4f2cc6f
---

# 21-02 Summary: Frontend Username Start-Chat Flow

## Completed

- Replaced new-chat state, props, and payload typing from email to username.
- Updated the chat sidebar empty state and new-chat dialog copy to username-based discovery.
- Changed the new-chat input from email autocomplete to a plain username field with `targetUsername`.
- Wired the submit path through the shared frontend `validateUsername` helper and sent the normalized username.
- Added a typed `userApi.lookupByUsername` wrapper for the protected exact lookup endpoint.
- Updated component tests for the username dialog and sidebar behavior.

## Verification

- `cd Frontend/Chatify; npm test -- --run src/pages/chat/components/NewChatDialog.test.tsx src/pages/chat/components/ChatSidebar.test.tsx src/pages/chat/fixtureLeakGuard.test.ts`
- Result: 3 files passed, 16 tests passed.
- `cd Frontend/Chatify; npm run lint`
- Result: passed.
- `cd Frontend/Chatify; npm run build`
- Result: passed.

## Notes

- `Frontend/Chatify/src/pages/chat/chat.tsx` had unrelated local call-tone changes before this plan. Only the username-start-chat hunks were staged and committed.
