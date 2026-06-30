# Phase 48: Saved Messages And Bookmarks - Specification

**Created:** 2026-06-30
**Ambiguity score:** 0.10 (gate: <= 0.20)
**Requirements:** 6 locked

## Goal

Authenticated users can save, view, jump to, and remove personally bookmarked visible messages without exposing private message content to other users or changing shared conversation state.

## Background

Chatify already supports authorized message history, search context jumps, pinned messages, conversation organization, replies, mentions, attachments, encrypted-conversation limitations, and per-user delete-for-self visibility. Pinned messages are shared conversation state, not a private personal workflow. No saved-message or bookmark model, API, list UI, message action, cache state, or visual QA evidence exists for personal message bookmarks today.

Auto-selected recommendations:

- Saved messages are personal per-user state, not conversation-wide state, because this matches existing per-user organization patterns and avoids surprising other participants.
- Saved entries cover any standard visible message in direct, group, or space-channel conversations, because the existing message visibility contract can gate access consistently across these chat types.
- Tags, notes, folders, full saved-message search, and cross-account sharing are out of scope, because Phase48 should add the reliable baseline before expanding organization features.
- Encrypted conversations can save the message reference but saved-list previews must use generic encrypted copy instead of plaintext, because plaintext exists only in the local browser after decryption.

Initial ambiguity from roadmap-only context was high: goal 0.45, boundary 0.25, constraint 0.20, acceptance 0.15, ambiguity 0.72. Auto mode applied the recommendations above and raised the spec above the gate.

## Requirements

1. **Personal save state**: Each authenticated user can save and unsave a visible message as private per-user state.
   - Current: Message pinning is shared conversation state; no private saved-message state exists.
   - Target: Saving a message changes only the requesting user's saved state and never changes the message for other participants.
   - Acceptance: Two users in the same chat can have different saved states for the same message, and one user's save/unsave does not affect the other's saved list.

2. **Visibility-bound save authority**: Saving, unsaving, listing, and jumping to saved messages must respect existing message visibility and membership rules.
   - Current: Message history and context APIs filter by membership, delete-for-self, and deleted-for-everyone visibility; saved-message behavior does not exist.
   - Target: A user can save only messages they can currently see, and saved results exclude messages that later become hidden from that user or deleted for everyone.
   - Acceptance: Backend tests prove non-members, invalid message ids, delete-for-self-hidden messages, and deleted-for-everyone tombstones cannot be saved or returned as visible saved entries.

3. **Saved-message list**: Users can open a saved-message surface that lists their saved messages in newest-saved-first order with enough context to identify the conversation and message.
   - Current: The chat UI has conversation detail surfaces for shared assets and pinned messages but no personal saved-message surface.
   - Target: The saved-message surface shows loading, empty, error, populated, and unsave states; each item includes conversation context, sender/public identity context, safe preview text or attachment/encrypted fallback copy, and saved timestamp.
   - Acceptance: Frontend tests and visual QA prove the saved-message surface renders empty, loading/error, populated, and unsave states without clipped or overlapping controls on desktop and mobile.

4. **Message action workflow**: Users can save or unsave a message from message actions and see the message's requester-specific saved state in the chat UI.
   - Current: Message actions support reply, edit, copy, pin/unpin, report, and delete, but not save/unsave.
   - Target: The message action menu exposes a save/unsave command for eligible visible messages, disables or hides it for unsupported message states, and updates the message row/list state after the mutation settles.
   - Acceptance: Frontend tests prove save and unsave commands call the correct mutation, disabled states remain accessible, and the UI reflects saved state after mutation success.

5. **Encrypted and private-content boundary**: Saved-message previews must not leak encrypted plaintext, private emails, tokens, hidden content, or deleted content.
   - Current: Encrypted conversations intentionally disable unsupported plaintext server workflows, and public identity rules avoid exposing emails in chat surfaces.
   - Target: Saved encrypted messages use generic encrypted-message preview copy; deleted-for-everyone entries are omitted or shown only as unavailable metadata; sender/conversation context uses approved public identity fields only.
   - Acceptance: Backend/frontend tests and visual QA evidence show encrypted saved entries do not display decrypted text and saved-message payloads contain no private email fields.

6. **Verification coverage**: The saved-message workflow is covered by focused backend, frontend, and visual verification.
   - Current: Pin, search, reply, invite, and mention workflows have focused tests and visual QA, but saved-message workflows have none.
   - Target: Phase48 adds backend API tests, frontend hook/component tests, lint/build verification, and Hercules-compatible visual QA for the saved-message action and list workflows.
   - Acceptance: Verification artifacts record passing focused backend tests, focused frontend tests, `npm run lint`, `npm run build`, and visual QA screenshots for desktop and mobile saved-message scenarios.

## Boundaries

**In scope:**

- Private per-user save/unsave state for visible standard messages.
- Saved-message list surface reachable from the authenticated chat UI.
- Message action menu command for save/unsave.
- Requester-specific saved-state serialization for message history/context flows where the UI needs to reflect current state.
- Safe previews for text, attachment-only, voice/media/file, and encrypted saved messages.
- Authorization tests for non-members, hidden messages, deleted messages, and direct/group/space-channel membership.
- Desktop and mobile visual QA for message actions and the saved-message surface.

**Out of scope:**

- Shared conversation bookmarks or collaborative collections - this would overlap with pinned messages and needs separate product semantics.
- Tags, folders, notes, labels, or saved-message search - these are organization expansions after the baseline save/list/remove loop.
- Push/email notifications for saved messages - unrelated to bookmarking and already handled by notification phases.
- Restoring deleted or hidden messages from a saved list - saved state cannot bypass visibility and privacy rules.
- Export-specific saved-message formatting - account export already has its own privacy phase and should be extended separately if needed.
- Runtime bots, integrations, or public saved-message sharing - outside the approved private messenger baseline.

## Constraints

- Saved-message operations are cookie-authenticated and CSRF-protected through the existing API boundary.
- Saved-message state must be per-user and must not mutate shared message, chat, unread, delivery, read, pin, or notification state.
- Saved-list payloads must use public identity fields only and must not expose private emails, tokens, reset codes, invite tokens, raw cookies, or decrypted encrypted-message plaintext.
- Saved-list queries must be bounded by a fixed limit and ordered by saved timestamp, newest first.
- Existing direct, group, space-channel, delete-for-self, delete-for-everyone, attachment, and encrypted-message visibility semantics remain authoritative.
- Implementation must preserve local work in `Frontend/Chatify/src/pages/chat/chat.tsx` and keep edits scoped to Phase48 surfaces.

## Acceptance Criteria

- [ ] A member can save and unsave a visible direct-chat message without changing any other user's saved state.
- [ ] A member can save and list visible group and space-channel messages while non-members receive private not-found/forbidden responses.
- [ ] Hidden delete-for-self messages and deleted-for-everyone messages cannot appear as usable saved-list entries for the requester.
- [ ] Saved-list entries render safe conversation/sender context and previews for text, attachment-only, and encrypted messages without private emails or encrypted plaintext.
- [ ] Message actions expose save/unsave for eligible messages and reflect requester-specific saved state after reload or mutation success.
- [ ] The saved-message surface supports loading, empty, error, populated, jump-to-message, and unsave flows on desktop and mobile without clipped or overlapping text.
- [ ] Focused backend tests, focused frontend tests, frontend lint, frontend build, and Hercules-compatible visual QA pass and are recorded in Phase48 verification artifacts.

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes |
|---------------------|-------|-------|--------|-------|
| Goal Clarity        | 0.92  | 0.75  | met    | Personal save/list/jump/remove outcome is measurable. |
| Boundary Clarity    | 0.94  | 0.70  | met    | Explicitly excludes shared bookmarks, tags, notes, search, and export formatting. |
| Constraint Clarity  | 0.84  | 0.65  | met    | Privacy, auth, bounded query, and encrypted-message boundaries are specified. |
| Acceptance Criteria | 0.88  | 0.70  | met    | Criteria cover backend authority, frontend behavior, safe previews, and visual QA. |
| **Ambiguity**       | 0.10  | <=0.20| met    | Gate passes. |

Status: met = dimension meets minimum. No dimensions are below minimum.

## Interview Log

| Round | Perspective      | Question summary | Decision locked |
|-------|------------------|------------------|-----------------|
| 1     | Researcher       | What exists today related to bookmarks? | Shared pinned messages exist; no private saved-message model/API/UI exists. |
| 2     | Simplifier       | What is the irreducible baseline? | Save, list, jump to, and unsave visible messages; no tags/notes/search. |
| 3     | Boundary Keeper  | What is explicitly not this phase? | Shared bookmarks, restored hidden content, saved-message export formatting, and public sharing are out of scope. |
| 4     | Failure Analyst  | What would make the phase unsafe or rejectable? | Returning hidden/deleted/encrypted plaintext/private-email data or changing shared message state would fail verification. |
| 5     | Seed Closer      | What recommendations should auto mode lock? | Personal per-user state, direct/group/space support, encrypted generic previews, and focused tests/visual QA. |

---

*Phase: 48-saved-messages-and-bookmarks*
*Spec created: 2026-06-30*
*Next step: $gsd-discuss-phase 48 - implementation decisions (how to build the saved-message workflow)*
