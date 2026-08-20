---
phase: 19-messenger-product-polish-and-notifications
artifact: context
status: complete
created_at: 2026-06-17T11:15:00+03:00
source: roadmap, requirements, Phase 18 readiness evidence, and current frontend implementation
---

# Phase 19 Context

## Locked Decisions

- D-01: Phase 19 is product polish for the existing messenger, not a release-readiness override.
- D-02: Planning may proceed now, but execution must preserve the Phase 14, Phase 15, Phase 17, and Phase 18 release-blocked stance unless the missing live evidence is supplied or explicitly accepted as blocked.
- D-03: Browser notifications are limited to the current web app runtime. Service workers, closed-tab push delivery, email notification delivery, and platform expansion stay out of scope.
- D-04: Notification copy must be privacy-safe. Browser notifications, in-app toasts, logs, traces, test names, and screenshots must not include raw message text, attachment names, reset codes, emails, tokens, or private chat content.
- D-05: Notification preferences must be scoped per authenticated user so one local account cannot inherit another account's notification or mute settings.
- D-06: Sound notifications can build from the existing `chatify_sound_enabled` behavior, but browser notifications must default to off until the user opts in and browser permission is granted.
- D-07: Muting a conversation suppresses alerting only. It must not suppress unread counts, delivery/read receipts, message cache updates, or accessible conversation state.
- D-08: Foreground messages in the currently selected conversation should not generate redundant alert noise. Background conversations may alert if not muted and preferences allow it.
- D-09: Session expiry, refresh failure, and logout must clear private message surfaces and be recoverable through sign-in.
- D-10: Multi-tab logout or auth expiry should propagate through `BroadcastChannel` when available with a storage-event fallback.
- D-11: Existing component boundaries are the preferred implementation path: Settings, socket hook, sidebar/list items, state-view components, auth hooks, and focused tests.
- D-12: `Frontend/Chatify/src/pages/chat/chat.tsx` is protected local work. Read it before integration edits and keep any changes narrowly scoped to Phase 19 wiring.
- D-13: Execution must stay inline in the current Codex thread; do not use subagents.

## Canonical Inputs

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/18-operational-observability-and-runbook-hardening/18-OPERATIONS-READINESS.md`
- `.planning/phases/18-operational-observability-and-runbook-hardening/18-VERIFICATION.md`
- `Frontend/Chatify/src/utils/sounds.ts`
- `Frontend/Chatify/src/components/SettingsModal.tsx`
- `Frontend/Chatify/src/components/Toast.tsx`
- `Frontend/Chatify/src/api/axios.ts`
- `Frontend/Chatify/src/hooks/useAuthQuery.ts`
- `Frontend/Chatify/src/hooks/useChatSocket.ts`
- `Frontend/Chatify/src/pages/chat/chat.tsx`
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx`
- `Frontend/Chatify/src/pages/chat/components/ChatListItem.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageList.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx`
- `Frontend/Chatify/src/pages/chat/hooks/useSelectedChatPersistence.ts`
- `Frontend/Chatify/src/hooks/useChatSocket.test.tsx`
- `Frontend/Chatify/src/components/SettingsModal.test.tsx`
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts`

## Current Evidence

- Phase 18 passed operations hardening, but production live acceptance, production delivery evidence, local call smoke, and production TURN/smoke evidence remain blocked.
- `Frontend/Chatify/src/utils/sounds.ts` already stores sound preference under `chatify_sound_enabled` and plays a local notification sound.
- `SettingsModal.tsx` exposes a sound toggle and account/profile controls, but it does not model browser notification permission states or per-user notification settings.
- `useChatSocket.ts` plays sounds for selected-chat incoming messages when sound is enabled, but it returns before alerting for messages from non-selected chats.
- `ChatListItem.tsx` shows latest message text inside the authenticated app sidebar. Browser-level alerts must not reuse this private preview pattern.
- `ConversationPane.tsx`, `MessageList.tsx`, and `MessageSearchResults.tsx` already render many state surfaces, but they do not share a complete product-polish vocabulary.
- `axios.ts` dispatches `chatify:auth-expired`, and existing smoke tests prove private conversation content is hidden after auth expiry.
- `useSelectedChatPersistence.ts` already scopes selected chat restoration per user and can inform notification preference scoping.
- Existing frontend tests cover Settings profile picture, socket behavior, session-expired conversation state, blocked state, message search state, and Playwright smoke basics.

## Recommendation

Treat Phase 19 execution as a five-plan sequential UI/product pass. Start with a tested notification preference model, then wire it into Settings/socket/sidebar, then polish auth/session behavior, then consolidate state surfaces, and finish with Playwright/evidence gates.
