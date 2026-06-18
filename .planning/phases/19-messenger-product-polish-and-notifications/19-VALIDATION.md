---
phase: 19-messenger-product-polish-and-notifications
artifact: validation-plan
status: planned
created_at: 2026-06-17T11:15:00+03:00
---

# Phase 19 Validation Plan

## Preflight

- Confirm Phase 18 operations hardening remains complete.
- Confirm Phase 14, Phase 15, and Phase 17 release blockers are preserved unless real production/local smoke evidence is supplied.
- Inspect current dirty work before editing `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Do not add service worker push or email notifications.

## Focused Unit And Hook Tests

- `cd Frontend/Chatify; npm test -- --run src/hooks/useNotificationPreferences.test.tsx`
- `cd Frontend/Chatify; npm test -- --run src/utils/notificationPrivacy.test.ts`
- `cd Frontend/Chatify; npm test -- --run src/components/SettingsModal.test.tsx`
- `cd Frontend/Chatify; npm test -- --run src/hooks/useChatSocket.test.tsx`
- `cd Frontend/Chatify; npm test -- --run src/pages/chat/components/ChatSidebar.test.tsx src/pages/chat/components/ChatListItem.test.tsx`
- `cd Frontend/Chatify; npm test -- --run src/pages/chat/components/ConversationPane.test.tsx src/pages/chat/components/MessageList.test.tsx src/pages/chat/components/MessageSearchResults.test.tsx src/pages/chat/components/MessageComposer.test.tsx`
- `cd Frontend/Chatify; npm test -- --run src/hooks/useAuthQuery.test.tsx src/api/axios.test.ts`

## Frontend Quality Gates

- `cd Frontend/Chatify; npm run lint`
- `cd Frontend/Chatify; npm run build`
- `cd Frontend/Chatify; npm test -- --run`

## Playwright Gates

- `cd Frontend/Chatify; npm run test:ui -- --grep "Phase 19"`
- Keep the existing auth-expired privacy smoke passing.
- Add mobile and desktop checks for Settings notification controls, muted conversation state, empty/no-results/offline copy, and no horizontal overflow.

## Privacy Guards

- Notification helper tests must prove raw message text and attachment names are not used in browser notification title/body.
- Search or grep Phase 19 files for accidental private-content examples before closeout.
- Evidence files must use sanitized labels and placeholders only.

## Closeout Evidence

- Create `19-PRODUCT-POLISH-EVIDENCE.md` with command results, screenshots if produced, and residual blockers.
- Create `19-VERIFICATION.md` with success criteria status.
- Create `19-01-SUMMARY.md` through `19-05-SUMMARY.md` during execution.

## Recommendation

Keep the Phase 19 verification bar frontend-heavy. Backend changes should be avoided unless execution proves a server-side preference contract is necessary.
