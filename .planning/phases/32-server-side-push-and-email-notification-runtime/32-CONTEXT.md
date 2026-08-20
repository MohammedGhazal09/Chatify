# Phase 32 Context

## Relevant Prior Work

- Phase 19 introduced local notification preferences, foreground browser alerts, safe generic copy, and muted-chat suppression in the socket hook.
- Phase 30 designed the external notification architecture and recommended server preferences, outbox-based delivery, generic templates, provider result logging, unsubscribe handling, and future E2EE-safe defaults.
- Phase 31 added admin enforcement and message-send restrictions, so notification delivery must respect current conversation safety controls and avoid reviving blocked activity.

## Current Code Anchors

- `Frontend/Chatify/src/hooks/useNotificationPreferences.ts` owns local sound/browser/mute preferences.
- `Frontend/Chatify/src/components/SettingsModal.tsx` renders notification controls.
- `Frontend/Chatify/src/utils/notificationPrivacy.ts` returns generic notification copy.
- `Backend/Chatify/Controller/messageController.mjs` owns HTTP message creation and idempotent retry repair.
- `Backend/Chatify/Utils/conversationControls.mjs` owns direct-chat block state and unblocked contact filtering.
- `Backend/Chatify/Services/emailService.mjs` owns Brevo email transport for password reset.
- `Backend/Chatify/Utils/observabilityLogger.mjs` redacts sensitive log metadata.

## Implementation Boundaries

- Preserve the existing local browser notification path for active browser sessions.
- Do not touch unrelated screenshot/report artifacts already present in the worktree.
- Do not overwrite local work in `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Keep all external notification templates generic unless a later phase explicitly approves previews.
- Treat provider credentials as optional for local verification; production behavior must fail closed with sanitized errors when required secrets are missing.

## Verification Focus

- Backend service tests for preference normalization, outbox dedupe, mute/block/unsubscribe suppression, and dry-run provider results.
- Backend API tests for CSRF-protected preference updates.
- Frontend hook/settings tests for server-backed preferences and local browser permission behavior.
- `npm test` focused runs for changed backend/frontend tests, plus lint/build if frontend changes compile cleanly.
