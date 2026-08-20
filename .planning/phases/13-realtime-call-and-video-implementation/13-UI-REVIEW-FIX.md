---
phase: 13-realtime-call-and-video-implementation
artifact: ui-review-fix
status: fixed
fixed_at: 2026-06-17T09:55:00+03:00
---

# Phase 13 UI Review Fix

## Fixed

- Added visible unavailable-call copy below the detail rail/drawer action grid.
- Added visible disabled descriptions inside the More menu call actions.
- Preserved stable accessible names for `Call` and `Video call` while exposing disabled reasons through accessible descriptions.
- Updated the Phase 07 e2e fixture to include direct-chat `conversationControls`, so Phase 13 call availability evidence no longer reports an incorrect direct-chat guard.
- Added mobile Phase 13 Playwright coverage for the More menu and detail drawer call availability surfaces.

## Files Changed

- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationMoreMenu.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationMoreMenu.test.tsx`
- `Frontend/Chatify/src/pages/chat/components/ChatContextRail.test.tsx`
- `Frontend/Chatify/e2e/chat-calls.spec.ts`
- `Frontend/Chatify/e2e/fixtures/phase07BehaviorFixture.ts`

## Verification

- `cd Frontend/Chatify; npm test -- --run src/pages/chat/components/ConversationMoreMenu.test.tsx src/pages/chat/components/ChatContextRail.test.tsx src/pages/chat/components/ConversationDetailDrawer.test.tsx` - passed, 3 files / 11 tests.
- `cd Frontend/Chatify; npm test -- --run` - passed, 39 files / 202 tests.
- `cd Frontend/Chatify; npm run test:ui -- --grep "Phase 13 call"` - passed, 2 local browser checks / 1 gated live smoke skipped.
- `cd Frontend/Chatify; npm run lint` - passed.
- `cd Frontend/Chatify; npm run build` - passed.
