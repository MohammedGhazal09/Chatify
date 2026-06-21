---
phase: 33-conversation-organization-and-focus-controls
plan: 01
subsystem: backend
tags: [conversation-organization, chat-api, privacy, notifications]
requires:
  - phase: 32-server-side-push-and-email-notification-runtime
    provides: server notification mute source of truth
provides:
  - Per-user conversation organization persistence
  - Chat organization update API
  - Requester-scoped organization serialization
affects: [chat-list, notification-mute, privacy]
key-files:
  created:
    - Backend/Chatify/Models/conversationOrganizationModel.mjs
    - Backend/Chatify/Utils/conversationOrganization.mjs
    - Backend/Chatify/test/chat/chat.organization.test.mjs
  modified:
    - Backend/Chatify/Controller/chatController.mjs
    - Backend/Chatify/Routes/chatRouter.mjs
requirements-completed: [V2-ORG-01, V2-NOTF-03, BLOCK-02, TEST-05]
completed: 2026-06-20
---

# Phase 33 Plan 01: Backend Organization Contract Summary

## Accomplishments

- Added `ConversationOrganization` as per-user state for archived, pinned, and favorite conversations.
- Added requester-specific `organizationState` to chat serialization.
- Added protected `PATCH /api/chat/:chatId/organization`.
- Kept `muted` backed by `User.notificationPreferences.mutedChatIds` so Phase 32 notification delivery continues to suppress muted chats.
- Added same-user `conversation:organization-updated` socket payloads for multi-tab cache updates.
- Added backend tests for per-user isolation, non-member rejection, invalid patch rejection, mute sync, privacy-safe chat payloads, and pinned sorting.

## Verification

- `npm test -- chat.organization.test.mjs chat.block-controls.test.mjs notification.outbox.test.mjs` from `Backend/Chatify`: 3 files, 11 tests passed.
- `npm run quality:backend` from repo root: 43 files, 230 tests passed.

## Notes

- Archive, pin, and favorite do not mutate the shared `Chats` record.
- Muting through the organization endpoint updates the same preference list used by the notification outbox eligibility checks.
