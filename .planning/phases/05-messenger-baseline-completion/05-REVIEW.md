---
phase: 05-messenger-baseline-completion
phase_number: "05"
phase_name: messenger-baseline-completion
status: issues_found
depth: standard
files_reviewed: 29
reviewed_at: 2026-06-09
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
skills_used:
  - gsd-code-review
  - find-skills
  - code-review-analysis
  - typescript-review
  - react-best-practices
  - api-and-interface-design
  - accessibility
  - tdd
---

# Phase 05 Code Review

## Summary

Phase 05 is broadly solid: the backend direct-chat and message-search contracts are privacy-aware and well covered, the selected-chat persistence logic is validated against accessible chats, and the smoke tests now exercise the core desktop/mobile baseline. I found one warning-level regression in the socket hook cleanup path.

## Findings

### WR-001: Previous-chat typing state is not cleared on chat switch

**Severity:** Warning
**Category:** Frontend state / realtime cleanup
**File:** `Frontend/Chatify/src/hooks/useChatSocket.ts:465`

**Problem:** The room-change effect tries to clear typing state when `previousRoom !== nextRoom`, but React runs the previous effect cleanup before the new effect body. That cleanup emits `chat:leave` and sets `activeRoomRef.current = null` at lines 480-484. When the next effect body runs, `previousRoom` is already `null`, so the branch at lines 465-468 does not execute during a normal `chatId` change. The room is left, but `clearAllTypingForChat(previousRoom)` and `clearTypingTimeoutsForChat(...)` are skipped.

**Impact:** Typing state from the previous chat can remain in the presence store until the timeout fires. If the user switches away and quickly returns, stale typing indicators can reappear even though Phase 05 claims selected-chat typing cleanup as part of auth/session hygiene.

**Recommendation:** Clear the captured `nextRoom` in the cleanup before nulling `activeRoomRef`, or otherwise move the previous-room typing cleanup into the cleanup path that actually runs on chat changes:

```ts
return () => {
  if (nextRoom && activeRoomRef.current === nextRoom) {
    socket.emit('chat:leave', nextRoom);
    presenceStoreRef.current.clearAllTypingForChat(nextRoom);
    clearTypingTimeoutsForChat(typingTimeoutRef.current, nextRoom);
    activeRoomRef.current = null;
  }
};
```

Add a focused `useChatSocket` hook test that seeds typing for `chat-1`, rerenders with `chat-2`, and asserts `chat-1` typing state and timeout cleanup are immediate.

## Verification

- `cd Backend/Chatify; npm test` - passed, 12 files / 66 tests.
- `cd Frontend/Chatify; npm test` - passed, 14 files / 50 tests.
- `cd Frontend/Chatify; npm run lint` - passed.
- `cd Frontend/Chatify; npm run build` - passed.
- `cd Frontend/Chatify; npm run test:ui` - passed, 5 Playwright tests.

## Review Scope

Scope was derived from the Phase 05 summary artifacts and the Phase 05 implementation diff. Reviewed backend chat/message controllers, chat model changes, message-state helpers, message routes, backend tests, frontend API/query/socket/session state changes, chat page orchestration, chat components, selected-chat persistence, store cleanup, unit tests, and Playwright smoke.

## Recommendation

Fix `WR-001` before closing Phase 05 validation. The change is narrow and should be paired with the missing hook-level regression test; the existing verification set should stay green afterward.
