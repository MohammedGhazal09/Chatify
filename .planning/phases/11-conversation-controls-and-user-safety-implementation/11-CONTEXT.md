# Phase 11: Conversation Controls And User Safety Implementation - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 turns the visible conversation control surfaces into real, authorized product behavior. It implements server-backed direct-message block/unblock controls, conversation capability state, block-aware HTTP and Socket.IO enforcement, accessible More/search actions, unloaded search-result jumping, server-backed pinned/shared detail sections, shared-asset paging, and honest runtime security rows. It does not implement full calls, video, voice messages, identity image editing, group moderation, delete/archive semantics, full export, or production-live acceptance.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**12 requirements are locked.** See `11-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `11-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Real message-search entry points from header, desktop rail, and mobile drawer.
- Search result jump/fetch behavior for unloaded but authorized messages.
- Accessible conversation More menu containing only implemented Phase 11 actions.
- Directed direct-message block/unblock state, API contract, and frontend controls.
- HTTP and Socket.IO enforcement of blocked direct-message state.
- Composer/menu/header/detail UI states driven by server-backed conversation capabilities.
- Pinned messages, shared files, shared media, and conversation security rows backed by real data or honestly hidden/unavailable.
- Shared asset load-more behavior for server-paginated file/media results.
- Backend, frontend, accessibility, and Playwright verification for Phase 11 behavior.

**Out of scope (from SPEC.md):**
- Full audio/video call implementation - Phase 13 owns call signaling, media permissions, and call state machines.
- Voice message recording/playback - Phase 12 owns voice message workflows.
- Identity image or identity mark customization - Phase 12 owns user identity imagery persistence and validation.
- Group-chat blocking or moderation - Phase 11 covers direct-message safety only.
- Delete/archive conversation actions - current delete semantics are shared/destructive and need a separate per-user archive/delete contract before exposure.
- Full conversation export - exporting loaded messages is not part of the approved Phase 11 minimum and could imply incomplete or unsafe history export.
- Production live acceptance claim - Phase 14 owns the final deployed Vercel/Render acceptance gate.
- End-to-end encryption, abuse reports, admin moderation, native apps, and push notifications - these remain outside v1 reconstruction scope or later roadmap work.

</spec_lock>

<decisions>
## Implementation Decisions

### Block Persistence And API Contract
- **D-01:** Store blocks in a separate `UserBlock` collection with unique `{ blocker, blockedUser }`, timestamps, and optional `sourceChatId`. Do not store the primary block contract as arrays on `Users` or embedded mutable state on `Chats`.
- **D-02:** Expose direct-message block/unblock through chat-scoped routes, preferably `POST /api/chat/:chatId/block` and `DELETE /api/chat/:chatId/block`.
- **D-03:** Block/unblock must be authenticated, membership-checked, idempotent, direct-chat-only, reject self-block, and preserve existing authorized message history.
- **D-04:** Use additive structured error codes while preserving the current response envelope style. Recommended codes include `MESSAGING_BLOCKED`, `GROUP_BLOCK_UNSUPPORTED`, and `SELF_BLOCK_UNSUPPORTED`.

### Conversation Capability State
- **D-05:** Add a server-backed `conversationControls` object to serialized direct chat responses and return updated controls from block/unblock responses.
- **D-06:** Recommended fields are `canSendMessage`, `canBlockUser`, `canUnblockUser`, `blockedByMe`, `blockedMe`, and `messagingDisabledReason`.
- **D-07:** The frontend may use `blockedMe` or an equivalent reason for behavior, but user-facing copy for the blocked counterpart must remain neutral, such as "Messaging is unavailable."
- **D-08:** Use the selected chat's capability state to drive composer availability, More menu labels, header/detail controls, security rows, and retry/error recovery. Avoid client-only inference for safety-sensitive state.

### HTTP And Realtime Block Enforcement
- **D-09:** Create shared backend helpers such as `getConversationControls` and `assertCanMessageDirectChat`; use them from HTTP controllers and Socket.IO handlers instead of duplicating block logic.
- **D-10:** `POST /api/message/new-message` must reject blocked direct-message sends before persistence, latest-message updates, unread updates, or socket emits.
- **D-11:** Allow blocked users to join/read authorized historical chat rooms, but suppress new activity events between the blocked pair.
- **D-12:** Suppress new message, typing, presence/last-seen exposure, delivered/read activity, reactions, pin/unpin, edit, delete-for-everyone, and future call-attempt events between blocked direct-message participants after the block.
- **D-13:** Allow viewing/downloading prior authorized history and attachments after block. Allow delete-for-self because it affects only the current user's visibility.
- **D-14:** Presence suppression should be pair-specific for the blocked direct chat. Blocking one user must not hide a participant's presence from unrelated authorized conversations.

### Search And More Menu Behavior
- **D-15:** Header, desktop detail rail, and mobile detail drawer search controls open the same server-backed message-search workflow and focus the same search input.
- **D-16:** Implement unloaded search-result jumps with a bounded iterative `loadMoreMessages` strategy using existing message-history cursor pagination first. Add a new backend "around message" endpoint only if planning/execution proves the current cursor contract cannot reliably load the target.
- **D-17:** Header More opens an accessible action menu, not the detail panel directly. The menu contains only Phase 11 supported actions: Search messages, Block or Unblock user for direct chats, and Conversation details.
- **D-18:** The detail panel "More conversation actions" control should open the same real action menu, or be removed if the shared menu cannot be reached cleanly. It must not remain an enabled no-op or disabled placeholder if the header has the real menu.
- **D-19:** Keep call and video controls honestly disabled in Phase 11, with block-safe capability state ready for Phase 13. Do not implement partial call/video signaling in this phase.
- **D-20:** More menu accessibility must follow the menu-button pattern: button semantics, accessible label, open/close by click, Escape, outside click, keyboard navigation, focus return, and usable touch targets.

### Detail Surfaces And Security Rows
- **D-21:** Pinned messages, shared files, and shared media must render only from authorized server data. No production runtime fixture/static detail rows are allowed.
- **D-22:** Hide individual optional detail sections after loading when they are empty. If all optional detail content is empty, show one honest combined empty state instead of separate fake-looking empty rows.
- **D-23:** Preserve shared asset cursor metadata in frontend query data and expose explicit "Load more" controls for files and media when the server reports more assets.
- **D-24:** Conversation security rows should state only verifiable runtime facts from auth state, server membership/capability responses, socket state, and protected asset access behavior. Do not claim stronger guarantees such as end-to-end encryption or broad "verified secure" status.
- **D-25:** Security rows must degrade to unavailable/warning/error states on session expiry, non-member access, offline/reconnecting socket state, or protected asset access failure.

### Frontend Cache And Blocked-State UX
- **D-26:** After block/unblock, update returned chat controls immediately and invalidate targeted TanStack Query keys: `chats`, active `messages`, `pinnedMessages`, and `sharedAssets` for the selected chat. Do not reload the page as the normal recovery path.
- **D-27:** Disable the composer when controls say sending is unavailable. If a stale client attempts to send and receives a 403, mark any optimistic message failed, refresh controls, and show recoverable copy.
- **D-28:** When the current user blocked the other participant, show copy equivalent to "You blocked this user. Unblock to send" and expose the unblock action. When the other participant blocked the current user, show neutral unavailable copy and no retaliatory action prompt.
- **D-29:** Keep implementation inside existing frontend architecture: API methods in `src/api`, query/mutation state in `useChatQueries`, socket lifecycle in `useChatSocket`, and focused UI components for the More menu and detail states. Do not move durable server state or socket listeners into presentational components.

### Verification And Dependency Gates
- **D-30:** Phase 11 local/CI verification must include backend API and socket tests, frontend unit/component/hook tests, lint, build, and focused Playwright coverage for desktop/mobile and light/dark More, search, block/unblock, details, empty states, and drawer/rail behavior.
- **D-31:** Tests must prove blocked pairs cannot create new messages or receive inappropriate realtime events, while prior authorized history and protected attachment access remain available.
- **D-32:** Phase 11 may proceed locally, but production-ready claims remain blocked until Phase 10.1 live production delivery smoke passes or is explicitly documented as blocked with evidence.
- **D-33:** No subagents should be used for Phase 11 work in this Codex thread.

### the agent's Discretion
- The planner/executor may choose exact helper, model, route-handler, component, hook, and test file names if the contracts above are preserved.
- The planner/executor may decide whether a dedicated controls refresh endpoint is necessary after implementation research. Default is to serialize controls on chat responses and block/unblock responses first.
- The planner/executor may decide whether unloaded search jumping needs a new backend endpoint only after trying the bounded cursor-load approach.
- The planner/executor may choose exact user-facing copy as long as blocker copy is actionable, counterpart copy is neutral, and all disabled controls are honest.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Scope
- `.planning/phases/11-conversation-controls-and-user-safety-implementation/11-SPEC.md` — locked Phase 11 requirements, boundaries, constraints, and acceptance criteria.
- `.planning/phases/11-conversation-controls-and-user-safety-implementation/11-CONTEXT.md` — implementation decisions captured by this discussion.
- `.planning/PROJECT.md` — project core value, brownfield constraints, repository hygiene, deployment context, and no-subagent preference.
- `.planning/REQUIREMENTS.md` — CTRL/BLOCK/BASE/MEDIA/TEST traceability for conversation controls and user safety.
- `.planning/ROADMAP.md` — Phase 11 dependency ordering and success criteria.
- `.planning/STATE.md` — current continuity record, including the Phase 10.1 production-smoke blocker.

### Prior Phase Contracts
- `.planning/phases/10.1-production-message-delivery-reliability-repair/10.1-CONTEXT.md` — message idempotency, realtime receive, receipt truth, and production-smoke blocker context that Phase 11 must preserve.
- `.planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-CONTEXT.md` — production fixture/static-control correction, honest disabled controls, detail rail/drawer behavior, and production evidence rules.
- `.planning/phases/09-messenger-interaction-quality-gate/09-CONTEXT.md` — behavior-first evidence, accessibility/keyboard guardrails, fixture isolation, and unsupported-control rules.
- `.planning/phases/08-media-files-and-conversation-detail-implementation/08-CONTEXT.md` — protected attachments, shared assets, pinned messages, detail panels, and factual security rows.
- `.planning/phases/03-canonical-message-state/03-CONTEXT.md` — canonical send/retry/status/unread/idempotency and pagination contracts that block enforcement must not regress.
- `.planning/phases/02-authenticated-realtime-contract/02-CONTEXT.md` — authenticated Socket.IO identity, membership checks, targeted emits, reconnect, and presence privacy rules.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — HTTP/API/query/socket layering, route/controller/model ownership, and anti-patterns around direct page API calls or UI-owned socket logic.
- `.planning/codebase/STACK.md` — React, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, npm, Vercel, and Render stack.
- `.planning/codebase/CONVENTIONS.md` — TypeScript, ESM, naming, error-handling, lint, import, comments, and module-boundary conventions.

### Backend Runtime And Test Files
- `Backend/Chatify/Routes/chatRouter.mjs` — route boundary for new chat-scoped block/unblock endpoints.
- `Backend/Chatify/Controller/chatController.mjs` — current direct-chat creation/listing serialization and likely integration point for conversation controls.
- `Backend/Chatify/Models/chatModel.mjs` — current direct chat membership/directKey model; do not overload this as the primary block store.
- `Backend/Chatify/Models/userModel.mjs` — current user presence/privacy fields; block state should remain separate unless planning proves otherwise.
- `Backend/Chatify/Utils/chatAccess.mjs` — existing membership helpers to extend with capability/block checks.
- `Backend/Chatify/Controller/messageController.mjs` — HTTP message creation, search, shared assets, pinned messages, read/delivery, edit/delete/reaction, and current membership checks.
- `Backend/Chatify/Config/socket.mjs` — Socket.IO room join, presence, typing, delivery/read, and emit helpers that must become block-aware.
- `Backend/Chatify/test/message/*.test.mjs` — backend message authorization/status/search/shared/pin test patterns to extend.
- `Backend/Chatify/test/socket/*.test.mjs` — socket authorization and message-state integration patterns to extend for block suppression.

### Frontend Runtime And Test Files
- `Frontend/Chatify/src/types/chat.ts` — add `conversationControls` and blocked-state event/API types here or adjacent typed modules.
- `Frontend/Chatify/src/api/chatApi.ts` — add chat-scoped block/unblock and possibly controls refresh methods.
- `Frontend/Chatify/src/api/messageApi.ts` — current search, shared assets, pinned messages, attachment preview/download, and cursor response contracts.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` — chat/message/search/shared/pinned query ownership, mutation invalidation, and send behavior.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` — Socket.IO client lifecycle and cache invalidation boundary; do not move listeners into UI components.
- `Frontend/Chatify/src/pages/chat/chat.tsx` — selected-chat orchestration, search, send/retry, rail/drawer state, and jump-to-message integration point. Preserve unrelated local work.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` — current More/Search/Call/Video header controls and action-menu integration point.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx` — current detail action grid, pinned/shared/security rows, and shared menu/search integration point.
- `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx` — current loaded-result behavior and unloaded-result limitation to repair.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` — composer disabled/error states and blocked-state copy integration point.
- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` — production runtime static-fixture guardrail to preserve and extend if needed.
- `Frontend/Chatify/e2e/*.spec.ts` — existing behavior-first Playwright patterns for desktop/mobile/light/dark evidence.

### Current External References Checked During Discussion
- `https://socket.io/docs/v3/rooms/` — Socket.IO rooms are server-side channels, relevant to filtering room emits for blocked pairs.
- `https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation` — targeted query invalidation after block/unblock and detail mutations.
- `https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/` — menu-button behavior for the conversation More action menu.

### Supporting Skills Used For This Discussion
- `C:/Users/saieh/.agents/skills/websocket-engineer/SKILL.md` — Socket.IO rooms, authorization, reconnect, and realtime suppression guidance.
- `C:/Users/saieh/.agents/skills/api-and-interface-design/SKILL.md` — API contract and interface-boundary guidance.
- `C:/Users/saieh/.agents/skills/accessibility/SKILL.md` — keyboard, focus, ARIA, disabled state, and interaction testing guidance.
- `C:/Users/saieh/.agents/skills/e2e-testing-patterns/SKILL.md` — Playwright behavior-first coverage and evidence guidance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `chatController.mjs`: Already creates, returns, and serializes direct chats with populated members and projected latest messages; extend this path with controls instead of creating a parallel selected-chat source.
- `chatAccess.mjs`: Already centralizes socket/member checks; extend or add adjacent helpers for block-aware capability checks.
- `messageController.mjs`: Already owns HTTP message creation, idempotency, search, shared assets, pinned messages, read/delivery, edit/delete/reaction, and membership checks; add block enforcement at these mutation boundaries.
- `socket.mjs`: Already authenticates sockets, joins rooms, manages presence, emits typing, delivery/read, unread, and room events; make these block-aware at emit/handler boundaries.
- `useChatQueries.ts`: Already owns chats, messages, send, search, shared assets, pinned messages, and mutation invalidation; add controls/block mutations and preserve cursor metadata here.
- `messageApi.ts`: Already exposes message search, shared assets with cursor metadata, pins, and protected asset URLs; align frontend paging with existing response shape.
- `ConversationHeader.tsx`, `ConversationDetailContent.tsx`, and `MessageSearchResults.tsx`: Current UI surfaces show the exact Phase 11 gaps and can be extended rather than replaced.

### Established Patterns
- Backend routers stay thin; controllers/helpers own validation, authorization, persistence, response shaping, and socket side effects.
- Frontend API clients hide endpoints; hooks own server state and cache updates; components render props and local UI state.
- Socket.IO identity must come from authenticated handshake/session state, not client-supplied user ids.
- Durable message state is canonical in TanStack Query and merges by durable `_id` plus `clientMessageId`.
- Unsupported controls must be hidden or honestly disabled; enabled inert controls are blocking failures.
- Detail panels must not synthesize static pinned/shared/security rows in production runtime.
- Visual identity remains abstract and non-living; no humans, animals, plants, mascots, portraits, profile photos, or realistic avatars.

### Integration Points
- Add a block model and capability helper under backend model/utils or service boundaries.
- Extend chat serialization in `getAllChats`, direct-chat creation/continuation, and block/unblock responses with `conversationControls`.
- Add chat-scoped block/unblock routes to `chatRouter.mjs`.
- Gate `newMessage` and block-sensitive message mutations in `messageController.mjs`.
- Gate Socket.IO typing, presence, delivery/read, new-message emits, pin/unpin, reaction/edit/delete-for-everyone, and future call-attempt events through shared capability checks.
- Add typed frontend controls fields, chat API methods, query hooks, mutations, and targeted invalidation.
- Replace header/details More behavior with one accessible shared action menu.
- Upgrade search result selection to load older pages until the authorized target message appears or a bounded failure state is reached.
- Preserve and extend browser/component tests around detail rail, mobile drawer, search, composer, More menu, and blocked states.

</code_context>

<specifics>
## Specific Ideas

- The final UI must behave like a real messenger, not a reference image with decorative controls.
- The More menu should be minimal and honest: Search messages, Block/Unblock user, Conversation details.
- Call/video stay disabled in this phase, but block state must be ready to prevent future call attempts.
- Search should feel unified regardless of entry point: header, desktop rail, and mobile drawer open the same workflow.
- Empty detail panels should feel intentionally empty, not like fake placeholder content.
- Blocked counterpart copy must be neutral; blocker copy can be actionable with an unblock path.

</specifics>

<deferred>
## Deferred Ideas

- Full audio/video call behavior remains Phase 13.
- Voice messages and identity image/mark editing remain Phase 12.
- Delete/archive conversation actions require a separate per-user archive/delete contract.
- Full conversation export remains out of scope until a complete, safe history-export contract exists.
- Final deployed product acceptance remains Phase 14 after all feature and reliability phases pass.

</deferred>

---

*Phase: 11-conversation-controls-and-user-safety-implementation*
*Context gathered: 2026-06-13*
