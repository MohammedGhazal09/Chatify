# Requirements: Chatify

**Defined:** 2026-06-07
**Core Value:** Users can trust Chatify to deliver private real-time conversations reliably, securely, and clearly.

## v1 Requirements

### Security And Auth

- [ ] **SEC-01**: Unsafe cookie-authenticated HTTP methods require active CSRF protection or an explicitly documented safe exemption.
- [ ] **SEC-02**: Auth, token, OAuth, reset, socket, and request logs redact secrets and user-identifying data by default.
- [ ] **SEC-03**: Password reset codes or tokens are stored safely, are single-use, expire, and enforce attempt limits.
- [ ] **SEC-04**: Environment requirements are documented in sanitized example files without committing secrets.
- [ ] **AUTH-01**: User can sign up, log in, refresh, and log out with predictable session behavior.
- [ ] **AUTH-02**: User sees a recoverable state when the session expires or refresh fails.
- [ ] **AUTH-03**: OAuth callback behavior redirects only to approved frontend origins.

### Realtime Authorization

- [ ] **RT-01**: Socket.IO connections derive user identity from verified session data, not client-supplied user ids.
- [ ] **RT-02**: Server checks chat membership before joining rooms or processing chat-scoped socket events.
- [ ] **RT-03**: Typing, delivery, read, edit, delete, reaction, and notification events are rejected for unauthorized chats.
- [ ] **RT-04**: Socket reconnect reconciles selected chat messages, conversation list state, unread counts, and presence from server truth.
- [ ] **RT-05**: Presence state handles reconnects and disconnects without trusting stale client claims.

### Message Reliability

- [ ] **MSG-01**: User can send a direct message and see it transition through one canonical sending, sent, delivered, and read lifecycle.
- [ ] **MSG-02**: User can receive messages in real time without duplicates from optimistic updates, mutation responses, and socket events.
- [ ] **MSG-03**: User can reload a chat and see only messages they are authorized to view, excluding messages deleted for that user.
- [ ] **MSG-04**: User can edit, delete for self, delete for everyone, and react to messages only when authorized.
- [ ] **MSG-05**: Unread counts are derived or synchronized per user and do not drift from read receipt state.
- [ ] **MSG-06**: Message history loads with scalable pagination that avoids deep offset behavior for large chats.
- [ ] **MSG-07**: Message validation boundaries are consistent between controller checks, model constraints, and frontend form rules.

### Chat User Experience

- [x] **UI-01**: User sees a responsive messenger layout with conversation sidebar, selected conversation, message list, composer, and header actions.
- [x] **UI-02**: User can understand loading, empty, offline, error, sending, failed-send, deleted, edited, delivered, read, and typing states.
- [ ] **UI-03**: User can recover from failed sends or network errors without losing message context.
- [x] **UI-04**: User can use message actions without layout shifts, overlapping controls, or hidden state changes.
- [x] **UI-05**: User can use the chat experience comfortably on desktop and mobile viewports.
- [x] **UI-06**: Chat UI code is split into focused components and hooks so future changes are testable and reviewable.

### Messenger Baseline Features

- [x] **BASE-01**: User can search conversations or contacts from the sidebar.
- [x] **BASE-02**: User can search messages within the selected conversation.
- [x] **BASE-03**: User can distinguish online, offline, and typing status without exposing unauthorized presence data.
- [x] **BASE-04**: User can start or continue direct-message conversations from the existing user/chat data model.
- [x] **BASE-05**: User can navigate away and return without losing selected conversation context unnecessarily.

### Tests And Verification

- [ ] **TEST-01**: Backend request tests cover auth lifecycle, CSRF enforcement, message authorization, validation boundaries, and password reset behavior.
- [ ] **TEST-02**: Socket integration tests cover authenticated handshake, unauthorized event rejection, room membership, typing, delivery, read, edit, delete, reaction, and reconnect behavior.
- [x] **TEST-03**: Frontend tests cover optimistic send, rollback, duplicate merge, unread updates, session-expired state, and core chat UI states.
- [ ] **TEST-04**: Each auth, socket, and message phase has blocking security acceptance criteria and verification evidence.

## v2 Requirements

### Platform Expansion

- **V2-GRP-01**: User can create and participate in group conversations.
- **V2-MEDIA-01**: User can send attachments or media previews.
- **V2-NOTF-01**: User can receive push or email notifications for new messages.
- **V2-MOD-01**: User can block or report another user.
- **V2-ADMIN-01**: Admin can review abuse reports and moderate accounts or content.
- **V2-E2EE-01**: Users can opt into end-to-end encrypted conversations after storage and delivery tradeoffs are designed.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile apps | Web-first reconstruction comes before platform expansion. |
| End-to-end encryption | Requires a separate message storage and key-management design. |
| Payments or monetization | Not relevant to the approved messenger reconstruction goal. |
| Full Slack/Discord feature parity | Groups, channels, voice, bots, and integrations would spread the current milestone too thin. |
| Large admin suite | Moderation/admin work should follow after private DMs are reliable and secure. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| SEC-04 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| TEST-01 | Phase 1 | Pending |
| TEST-04 | Phase 1 | Pending |
| RT-01 | Phase 2 | Pending |
| RT-02 | Phase 2 | Pending |
| RT-03 | Phase 2 | Pending |
| RT-04 | Phase 2 | Pending |
| RT-05 | Phase 2 | Pending |
| TEST-02 | Phase 2 | Pending |
| MSG-01 | Phase 3 | Pending |
| MSG-02 | Phase 3 | Pending |
| MSG-03 | Phase 3 | Pending |
| MSG-04 | Phase 3 | Pending |
| MSG-05 | Phase 3 | Pending |
| MSG-06 | Phase 3 | Pending |
| MSG-07 | Phase 3 | Pending |
| UI-01 | Phase 6 | Complete |
| UI-02 | Phase 6 | Complete |
| UI-03 | Phase 6 | Pending |
| UI-04 | Phase 6 | Complete |
| UI-05 | Phase 6 | Complete |
| UI-06 | Phase 6 | Complete |
| TEST-03 | Phase 4 | Complete |
| BASE-01 | Phase 5 | Complete |
| BASE-02 | Phase 5 | Complete |
| BASE-03 | Phase 5 | Complete |
| BASE-04 | Phase 5 | Complete |
| BASE-05 | Phase 5 | Complete |

**Coverage:**

- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-06-07*
*Last updated: 2026-06-07 after initial definition*
