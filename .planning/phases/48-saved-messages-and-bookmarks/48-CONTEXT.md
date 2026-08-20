# Phase 48: Saved Messages And Bookmarks - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 48 adds personal saved-message workflows to the existing messenger: users can save or unsave visible messages, open a private saved-message surface, and jump back to saved messages without changing shared conversation state.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**6 requirements are locked.** See `48-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `48-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**

- Private per-user save/unsave state for visible standard messages.
- Saved-message list surface reachable from the authenticated chat UI.
- Message action menu command for save/unsave.
- Requester-specific saved-state serialization for message history/context flows where the UI needs to reflect current state.
- Safe previews for text, attachment-only, voice/media/file, and encrypted saved messages.
- Authorization tests for non-members, hidden messages, deleted messages, and direct/group/space-channel membership.
- Desktop and mobile visual QA for message actions and the saved-message surface.

**Out of scope (from SPEC.md):**

- Shared conversation bookmarks or collaborative collections - this would overlap with pinned messages and needs separate product semantics.
- Tags, folders, notes, labels, or saved-message search - these are organization expansions after the baseline save/list/remove loop.
- Push/email notifications for saved messages - unrelated to bookmarking and already handled by notification phases.
- Restoring deleted or hidden messages from a saved list - saved state cannot bypass visibility and privacy rules.
- Export-specific saved-message formatting - account export already has its own privacy phase and should be extended separately if needed.
- Runtime bots, integrations, or public saved-message sharing - outside the approved private messenger baseline.

</spec_lock>

<decisions>
## Implementation Decisions

### Saved-State Semantics
- **D-01:** Use a dedicated `SavedMessage` persistence model keyed by `user` and `message`, with `chat` denormalized for list filtering and a unique `{ user, message }` index for idempotency.
- **D-02:** Save and unsave operations are per-user only and must not mutate the `Messages` document, chat organization state, read/delivery state, pinned state, unread counts, notifications, or sockets.
- **D-03:** Save is idempotent: saving an already-saved message returns success with the existing saved timestamp; unsaving an absent save returns success with `savedByRequester: false`.

### API Shape
- **D-04:** Keep saved-message endpoints under the existing protected message API boundary: `GET /api/message/saved`, `POST /api/message/:messageId/save`, and `DELETE /api/message/:messageId/save`.
- **D-05:** Saved-list responses are bounded by a fixed limit and ordered newest-saved-first; cursor pagination can be deferred unless implementation shows the existing hooks need it.
- **D-06:** Backend responses should include `message`, safe `chat` context, `savedAt`, and requester-specific `savedByRequester` metadata; payloads must use public user identity fields only.

### Authorization And Privacy
- **D-07:** Reuse the existing `loadChatForUser`, `canUserSeeMessage`, and `buildVisibleMessageFilter` patterns so saved-message authority matches current message history/context rules.
- **D-08:** Reject saving deleted-for-everyone messages and messages hidden from the requester through delete-for-self visibility.
- **D-09:** Saved encrypted messages are allowed as references, but saved-list preview copy must be generic encrypted-message copy and must not include decrypted plaintext.
- **D-10:** Saved-list serialization must exclude private email fields, invite tokens, reset codes, cookies, raw token values, and hidden message content.

### Frontend Interaction
- **D-11:** Add save/unsave to the existing `MessageActionMenu` rather than adding a separate inline command cluster.
- **D-12:** Show requester-specific saved state on message bubbles with a small bookmark indicator near metadata, not a large badge that competes with delivery/read state.
- **D-13:** Add a compact global saved-message dialog launched from the sidebar footer with a `Bookmark` icon, because saved messages are personal account state rather than selected-conversation detail.
- **D-14:** Saved-message dialog states must cover loading, empty, error, populated, item-level unsave, and jump-to-message.
- **D-15:** Jumping from a saved item should select the target conversation/channel, close the dialog, load message context when necessary, scroll the message into view, and use the existing highlight behavior.

### UI Direction
- **D-16:** Visual direction is restrained and work-focused, matching the current messenger shell: dense list, clear conversation context, small icon controls, and no card-heavy marketing treatment.
- **D-17:** The surface should feel like a personal retrieval tool for a focused chat user, under the same dark messenger lighting and rhythm already used by context rail and invite dialogs.
- **D-18:** Use lucide icons where available (`Bookmark`, `BookmarkCheck`, `X`, `RefreshCw`, `Trash2`, `MessageCircle`) and keep copy operational rather than explanatory.

### the agent's Discretion
- Choose whether saved-message query hooks live in `useChatQueries.ts` or a new focused hook if that keeps imports cleaner.
- Use focused backend/frontend tests rather than broad end-to-end fixtures.
- Keep the first saved-list limit conservative, aligned with pinned/shared surface limits unless a stronger local pattern exists.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/phases/48-saved-messages-and-bookmarks/48-SPEC.md` - Locked requirements, boundaries, constraints, and acceptance criteria.
- `.planning/REQUIREMENTS.md` - Requirement traceability and privacy constraints.
- `.planning/ROADMAP.md` - Phase status and plan list.
- `.planning/STATE.md` - Current phase chain and local completion status.

### Backend
- `Backend/Chatify/Routes/messageRouter.mjs` - Existing message route boundary for pins, search, context, and message mutations.
- `Backend/Chatify/Controller/messageController.mjs` - Membership checks, visible-message filters, context loading, pinned-message behavior, and response shaping.
- `Backend/Chatify/Models/messageModel.mjs` - Message persistence fields and indexes.
- `Backend/Chatify/Models/chatModel.mjs` - Direct, group, and space-channel chat membership context.
- `Backend/Chatify/Utils/messageState.mjs` - Message visibility, serialization, attachment summaries, and cursor helpers.
- `Backend/Chatify/test/message/message.pins.test.mjs` - Closest backend test pattern for message-level list/mutation workflows.

### Frontend
- `Frontend/Chatify/src/types/chat.ts` - Message, chat, pinned-message, and API payload types.
- `Frontend/Chatify/src/api/messageApi.ts` - Message API client patterns.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - Query keys, message queries, mutation invalidation, and pinned-message hooks.
- `Frontend/Chatify/src/hooks/messageCache.ts` - Message merge behavior that saved-state updates must preserve.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - Chat route orchestration, selected conversation state, action handlers, and jump-to-message behavior.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` - Sidebar footer entry point for the saved-message surface.
- `Frontend/Chatify/src/pages/chat/components/MessageActionMenu.tsx` - Existing message action menu integration point.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - Saved-state indicator integration point.
- `Frontend/Chatify/src/pages/chat/components/InviteLinksDialog.tsx` - Recent modal/dialog pattern for dense chat tool surfaces.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx` - Existing pinned-message item and jump/unsave interaction patterns.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MessageActionMenu`: already centralizes per-message actions and can add save/unsave without adding new bubble chrome.
- `MessageBubble`: already owns metadata row and can show a compact saved indicator without changing message layout.
- `useChatQueries`: already owns message, context, shared-asset, pinned-message, and mutation patterns.
- `messageApi`: already provides typed methods for message context, pins, edits, deletes, reads, and reactions.
- `handleJumpToMessage` in `chat.tsx`: already loads context, highlights, and scrolls a target message.
- `InviteLinksDialog`: provides a recent, tested overlay style for chat-adjacent management workflows.

### Established Patterns
- Backend message features validate in `messageController.mjs`, persist through Mongoose models, serialize through `messageState.mjs`, and expose thin router entries in `messageRouter.mjs`.
- Frontend server state should flow through API modules and React Query hooks, not direct Axios calls in pages.
- Message privacy is enforced by membership checks plus per-user visibility filters; saved messages must reuse that path rather than inventing a parallel access check.
- UI surfaces use Tailwind utility classes with existing `--chat-*` CSS variables and lucide icons.

### Integration Points
- Add a saved-message model under `Backend/Chatify/Models`.
- Extend message controller/router with save, unsave, and list handlers.
- Extend message serialization or controller-level response shaping with requester-specific `savedByRequester`.
- Extend frontend message types, API client, query hooks, message action menu, message bubble, and chat route orchestration.
- Add a new saved-message dialog component under `Frontend/Chatify/src/pages/chat/components`.

</code_context>

<specifics>
## Specific Ideas

- Saved-list item primary text should be the safe message preview; conversation and sender context should be secondary metadata.
- Empty state copy should be short and functional, such as "No saved messages" and "Save a message from its actions when you want to find it later."
- Encrypted saved-list preview should use generic copy such as "Encrypted message" rather than attempting to decrypt in the global list.
- The sidebar footer entry should be icon-forward and fit next to existing settings/moderation controls.

</specifics>

<deferred>
## Deferred Ideas

- Saved-message tags, folders, notes, and saved-message search.
- Shared bookmarks or team collections.
- Saved-message export formatting.
- Saved-message notification reminders.
- Public or invite-based saved-message sharing.

</deferred>

---

*Phase: 48-saved-messages-and-bookmarks*
*Context gathered: 2026-06-30*
