# Phase 44: Per-Conversation Message Drafts - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 44 delivers browser-local, per-user, per-conversation text drafts for the existing chat composer, with enough sidebar visibility for users to find an unfinished standard draft.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**5 requirements are locked.** See `44-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream work must read `44-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Browser-local text draft persistence keyed by authenticated user id and conversation id.
- Restore/save/clear lifecycle wired to the existing chat composer.
- Sidebar draft indicators for the conversations list.
- Draft cleanup during logout/session-expired private state clearing.
- Unit/component tests for storage, restoration, cleanup, isolation, and row display.

**Out of scope (from SPEC.md):**
- Server-side or cross-device draft sync - local drafts avoid new message/privacy backend contracts.
- Attachment, media, and voice draft persistence - browser `File` and recording objects cannot be safely restored after reload.
- Reply-target persistence - Phase 43 reply selection remains session-only to avoid stale hidden/deleted source semantics.
- Draft indicators inside the Spaces sidebar - composer restoration remains chat-id scoped, but channel list badges can be a later polish phase.
- Encrypted-at-rest local draft storage - encrypted conversation draft text stays local to the browser and never leaves the device, but localStorage encryption/key UX is a separate security design.

</spec_lock>

<decisions>
## Implementation Decisions

### Storage Contract
- **D-01:** Use a user-scoped localStorage key named `chatify_message_drafts:{userId}` that stores a JSON object keyed by conversation id.
- **D-02:** Store text and `updatedAt` metadata only. Do not persist attachment files, voice recordings, reply targets, upload states, or socket state.
- **D-03:** Treat missing, malformed, inaccessible, or storage-error reads as an empty draft map while keeping in-memory typing functional.

### Composer Lifecycle
- **D-04:** Add a dedicated hook beside existing chat-page hooks, likely `useConversationDrafts`, so the large `chat.tsx` orchestrator only wires state.
- **D-05:** On selected chat changes, load that chat's stored draft into `messageInput`. On input changes, write or remove the active chat draft.
- **D-06:** Successful sends clear the active chat draft through the existing `setMessageInput('')` success path. Failed sends and disabled sends keep text.
- **D-07:** Private chat cleanup must call a storage helper to remove all drafts for the user being cleared and also reset `messageInput`.

### Sidebar Visibility
- **D-08:** Pass a simple `draftsByChatId` text map into `ChatSidebar`, then into `ChatListItem`.
- **D-09:** Standard rows show `Draft:` plus a normalized bounded preview in the existing latest-message snippet slot.
- **D-10:** Encrypted rows show generic draft copy and do not expose plaintext draft snippets in the sidebar row or standard sidebar search.

### Verification Strategy
- **D-11:** Add hook tests under `Frontend/Chatify/src/pages/chat/hooks` for restore, isolation, clear, inaccessible pruning, and storage failures.
- **D-12:** Extend existing sidebar tests for draft display/search and encrypted generic copy.
- **D-13:** Use focused Vitest tests first, then frontend lint/build, then visual QA over desktop/mobile chat states.

### the agent's Discretion
- Keep helper names and exact preview length aligned with local component style.
- Prefer source-level tests over brittle full-page mocks unless the page integration needs coverage.

</decisions>

<canonical_refs>
## Canonical References

Downstream work must read these before planning or implementing.

### Phase Contract
- `.planning/phases/44-per-conversation-message-drafts/44-SPEC.md` - Locked requirements, boundaries, constraints, and acceptance criteria.
- `.planning/ROADMAP.md` - Phase 44 roadmap entry and dependency on Phase 43.
- `.planning/REQUIREMENTS.md` - Existing message/UI/privacy/test requirement families.

### Existing Frontend Patterns
- `Frontend/Chatify/src/pages/chat/chat.tsx` - Chat page state orchestration, send success cleanup, logout/session cleanup.
- `Frontend/Chatify/src/pages/chat/hooks/useSelectedChatPersistence.ts` - Existing per-user localStorage pattern for selected chat.
- `Frontend/Chatify/src/pages/chat/hooks/useSelectedChatPersistence.test.tsx` - LocalStorage hook test style.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` - Conversation filtering and list item wiring.
- `Frontend/Chatify/src/pages/chat/components/ChatListItem.tsx` - Latest-message snippet surface for draft indicator.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` - Controlled composer and send/disabled states.
- `Frontend/Chatify/src/utils/encryptedMessages.ts` - Encrypted conversation detection.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSelectedChatPersistence`: Provides the closest localStorage pattern, including user scoping and failure-tolerant reads/writes.
- `useChatViewState`: Owns `messageInput` and `setMessageInput`; draft persistence should wire to these rather than owning a separate composer state.
- `ChatSidebar` and `ChatListItem`: Already centralize conversation row filtering, latest snippet display, unread counts, mute/pin/favorite/archive badges, and selection.
- `MessageComposer`: Already receives controlled `value`, so no composer-internal persistence is needed.

### Established Patterns
- Frontend hooks use named exports and colocated hook tests.
- LocalStorage helpers ignore storage failures and preserve in-memory state.
- Sidebar search currently matches title and latest visible snippet, not private email.
- Encrypted conversation UI uses honest limitations and avoids server-readable plaintext leakage.

### Integration Points
- `ChatPage` should call the draft hook after `selectedChatId`, `chatIds`, and `messageInput` are available.
- `clearPrivateChatState()` should clear the user draft key and reset composer state.
- `handleSendMessage()` already clears `messageInput` only on successful mutation.
- `ChatSidebar` should receive `draftsByChatId` and include standard draft text in local search.

</code_context>

<specifics>
## Specific Ideas

- Use `Draft:` as the visible row prefix because it is short, familiar, and scannable.
- Keep encrypted row copy generic, for example `Draft saved on this device`, to avoid displaying plaintext in a collapsed list.
- Normalize preview whitespace and rely on existing truncate styling to prevent row growth.

</specifics>

<deferred>
## Deferred Ideas

- Cross-device/server draft sync can be considered only with an explicit privacy model and membership-checked backend contract.
- Attachment, voice, and reply-target draft restoration can be considered after a safe browser object persistence and stale-source design exists.
- Spaces sidebar channel draft badges can be added later if channel navigation needs the same list-level draft affordance.

</deferred>

---

*Phase: 44-per-conversation-message-drafts*
*Context gathered: 2026-06-30*
