# Phase 44: Per-Conversation Message Drafts - Specification

**Created:** 2026-06-30
**Ambiguity score:** 0.10 (gate: <= 0.20)
**Requirements:** 5 locked

## Goal

Authenticated users can switch conversations, reload the chat page, and return to each conversation's unsent text draft without sending draft content to the server.

## Background

Chatify already persists the selected chat per user in `Frontend/Chatify/src/pages/chat/hooks/useSelectedChatPersistence.ts`, and the composer input is currently held only in `useChatViewState()`. Switching conversations or reloading loses unsent text. The composer also has attachment and voice drafts, but those are session-only `File`/MediaRecorder objects and should not be persisted across reloads.

## Requirements

1. **Conversation-scoped text drafts**: Store unsent composer text separately for each authenticated user and selected conversation id.
   - Current: `messageInput` is a single in-memory string shared across the chat page session.
   - Target: Each chat id has its own local text draft under a user-scoped browser storage key.
   - Acceptance: Typing in chat A, switching to chat B, typing there, and returning to chat A restores chat A's text without mixing with chat B.

2. **Reload restoration**: Restore the selected conversation's text draft after a browser reload or fresh mount.
   - Current: Reloading the chat page clears composer text even when the selected chat is restored.
   - Target: Once auth and an accessible selected chat are available, the composer loads the saved draft for that chat.
   - Acceptance: A test seeds localStorage for user `user-1` and chat `chat-1`, mounts the hook/page state, and observes the composer value restored.

3. **Send and cleanup behavior**: Clear only the active conversation's draft after a successful send, while keeping drafts after failed or blocked send attempts.
   - Current: Successful send clears the one in-memory input; failed sends leave the current input in memory only.
   - Target: Successful send removes the stored draft for that chat; failed sends, disabled conversations, offline state, and too-long text do not erase the draft.
   - Acceptance: Focused tests prove empty input removes the stored chat draft and other chat drafts remain stored.

4. **Privacy and account isolation**: Drafts must remain local to the browser, scoped by authenticated user id, and cleared when private chat state is cleared.
   - Current: Selected chat storage is user-scoped, but no draft storage exists.
   - Target: Draft storage keys include the user id, are never sent through HTTP or Socket.IO, are not logged, and are removed on logout/session-expiry cleanup.
   - Acceptance: Tests show user `user-2` drafts are not restored for user `user-1`, and the logout cleanup removes `chatify_message_drafts:{userId}`.

5. **Draft visibility in conversation list**: Standard conversation rows expose a bounded draft indicator without breaking search, mobile, or encrypted-conversation privacy.
   - Current: Sidebar rows show only latest persisted message text or "No messages yet".
   - Target: Rows with a saved draft show a compact draft preview before the persisted latest message; encrypted conversations show generic draft copy instead of plaintext in the row.
   - Acceptance: Component tests prove a draft row displays `Draft:` with bounded text, search can find standard draft text, and encrypted rows do not expose the draft plaintext.

## Boundaries

**In scope:**
- Browser-local text draft persistence keyed by authenticated user id and conversation id.
- Restore/save/clear lifecycle wired to the existing chat composer.
- Sidebar draft indicators for the conversations list.
- Draft cleanup during logout/session-expired private state clearing.
- Unit/component tests for storage, restoration, cleanup, isolation, and row display.

**Out of scope:**
- Server-side or cross-device draft sync - local drafts avoid new message/privacy backend contracts.
- Attachment, media, and voice draft persistence - browser `File` and recording objects cannot be safely restored after reload.
- Reply-target persistence - Phase 43 reply selection remains session-only to avoid stale hidden/deleted source semantics.
- Draft indicators inside the Spaces sidebar - composer restoration remains chat-id scoped, but channel list badges can be a later polish phase.
- Encrypted-at-rest local draft storage - encrypted conversation draft text stays local to the browser and never leaves the device, but localStorage encryption/key UX is a separate security design.

## Constraints

- Keep the implementation in the existing React/Vite/Tailwind frontend; no backend model or API changes.
- Preserve the existing `Frontend/Chatify/src/pages/chat/chat.tsx` user work and keep edits narrowly scoped.
- LocalStorage failures must not break in-memory typing or sending.
- Draft preview text must be normalized, bounded, and overflow-safe for long, emoji, CJK, and RTL input.
- No private emails, tokens, cookies, or draft text may be logged.

## Acceptance Criteria

- [ ] The composer restores separate drafts for at least two conversations for the same user.
- [ ] Drafts persist through a reload/fresh hook mount for the authenticated user.
- [ ] User-scoped keys prevent restoring another user's drafts.
- [ ] Successful send clears only the active chat draft; failed/blocked sends do not clear stored text.
- [ ] Logout/session cleanup removes the active user's draft storage key and resets in-memory composer text.
- [ ] Standard sidebar rows show bounded draft preview text and can match standard draft text in search.
- [ ] Encrypted conversation sidebar rows show generic draft copy without plaintext preview.
- [ ] Focused frontend tests, lint, build, and visual QA cover the changed UI and logic.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.94 | 0.75 | met | Local text drafts with explicit restore/clear behavior. |
| Boundary Clarity | 0.92 | 0.70 | met | Server sync, attachments, reply persistence, and channel badges excluded. |
| Constraint Clarity | 0.86 | 0.65 | met | Frontend-only, localStorage-safe, privacy-scoped constraints are explicit. |
| Acceptance Criteria | 0.88 | 0.70 | met | Pass/fail tests and visual QA listed. |
| **Ambiguity** | 0.10 | <=0.20 | met | Ready for implementation planning. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today? | Selected chat is persisted per user; composer text is in-memory only. |
| 2 | Simplifier | What is the smallest useful scope? | Persist text drafts locally per user/chat; skip server sync and files. |
| 3 | Boundary Keeper | What is intentionally excluded? | Attachments, voice, reply target persistence, and spaces list badges are out of scope. |
| 4 | Failure Analyst | What would make this unsafe? | Cross-user leakage, encrypted plaintext previews, localStorage failures, and logout residue must be prevented. |
| 5 | Seed Closer | What UI proof is required? | Sidebar draft indicator plus composer restore tests and visual QA. |

---

*Phase: 44-per-conversation-message-drafts*
*Spec created: 2026-06-30*
*Next step: $gsd-discuss-phase 44 - implementation decisions*
