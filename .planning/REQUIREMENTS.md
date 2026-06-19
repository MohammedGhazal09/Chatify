# Requirements: Chatify

**Defined:** 2026-06-07
**Core Value:** Users can trust Chatify to deliver private real-time conversations reliably, securely, and clearly.

## v1 Requirements

### Security And Auth

- [x] **SEC-01**: Unsafe cookie-authenticated HTTP methods require active CSRF protection or an explicitly documented safe exemption.
- [x] **SEC-02**: Auth, token, OAuth, reset, socket, and request logs redact secrets and user-identifying data by default.
- [x] **SEC-03**: Password reset codes or tokens are stored safely, are single-use, expire, and enforce attempt limits.
- [x] **SEC-04**: Environment requirements are documented in sanitized example files without committing secrets.
- [x] **AUTH-01**: User can sign up, log in, refresh, and log out with predictable session behavior.
- [x] **AUTH-02**: User sees a recoverable state when the session expires or refresh fails.
- [x] **AUTH-03**: OAuth callback behavior redirects only to approved frontend origins.

### Realtime Authorization

- [x] **RT-01**: Socket.IO connections derive user identity from verified session data, not client-supplied user ids.
- [x] **RT-02**: Server checks chat membership before joining rooms or processing chat-scoped socket events.
- [x] **RT-03**: Typing, delivery, read, edit, delete, reaction, and notification events are rejected for unauthorized chats.
- [x] **RT-04**: Socket reconnect reconciles selected chat messages, conversation list state, unread counts, and presence from server truth.
- [x] **RT-05**: Presence state handles reconnects and disconnects without trusting stale client claims.

### Message Reliability

- [x] **MSG-01**: User can send a direct message and see it transition through one canonical sending, sent, delivered, and read lifecycle.
- [x] **MSG-02**: User can receive messages in real time without duplicates from optimistic updates, mutation responses, and socket events.
- [x] **MSG-03**: User can reload a chat and see only messages they are authorized to view, excluding messages deleted for that user.
- [x] **MSG-04**: User can edit, delete for self, delete for everyone, and react to messages only when authorized.
- [x] **MSG-05**: Unread counts are derived or synchronized per user and do not drift from read receipt state.
- [x] **MSG-06**: Message history loads with scalable pagination that avoids deep offset behavior for large chats.
- [x] **MSG-07**: Message validation boundaries are consistent between controller checks, model constraints, and frontend form rules.
- [x] **DELIV-01**: One user send action creates exactly one persisted message and one rendered sender bubble.
- [x] **DELIV-02**: Optimistic updates, HTTP mutation responses, socket echoes, retries, and refetches merge by `clientMessageId` and durable message id without duplicates.
- [x] **DELIV-03**: Recipient browsers receive new messages through Socket.IO without requiring page refresh.
- [x] **DELIV-04**: Delivered/read indicators reflect server-confirmed recipient delivery/read state, not only sender-side success.
- [x] **DELIV-05**: Two-account local and deployed smoke tests prove no duplicate sends, instant realtime receive, reconnect reconciliation, and refresh parity.

### Chat User Experience

- [x] **UI-01**: User sees a responsive messenger layout with conversation sidebar, selected conversation, message list, composer, and header actions.
- [x] **UI-02**: User can understand loading, empty, offline, error, sending, failed-send, deleted, edited, delivered, read, and typing states.
- [x] **UI-03**: User can recover from failed sends or network errors without losing message context.
- [x] **UI-04**: User can use message actions without layout shifts, overlapping controls, or hidden state changes.
- [x] **UI-05**: User can use the chat experience comfortably on desktop and mobile viewports.
- [x] **UI-06**: Chat UI code is split into focused components and hooks so future changes are testable and reviewable.

### Messenger Baseline Features

- [x] **BASE-01**: User can search conversations or contacts from the sidebar.
- [x] **BASE-02**: User can search messages within the selected conversation.
- [x] **BASE-03**: User can distinguish online, offline, and typing status without exposing unauthorized presence data.
- [x] **BASE-04**: User can start or continue direct-message conversations from the existing user/chat data model.
- [x] **BASE-05**: User can navigate away and return without losing selected conversation context unnecessarily.

### Functional Product Parity

- [x] **PARITY-01**: The messenger reference UI renders production chat, message, presence, status, search, and session state instead of static demo fixtures.
- [x] **PARITY-02**: Every visible messenger control performs a supported action or is intentionally hidden/disabled with an honest state.
- [x] **PARITY-03**: Desktop, mobile, light theme, and dark theme variants preserve the same working workflows and do not fork into layout-only implementations.

### Media And Detail Surfaces

- [x] **MEDIA-01**: User can attach and send supported images or files with validation, recoverable failures, and persisted message metadata.
- [x] **MEDIA-02**: User can preview, open, and download shared media/files only when authorized for the conversation.
- [x] **MEDIA-03**: Conversation detail surfaces for shared media, shared files, pinned messages, and security status use real data or are intentionally hidden until supported.
- [x] **MEDIA-04**: Shared media and shared files are derived from persisted attachments in production and never from static placeholder cards.

### Production Messenger Remediation

- [x] **PROD-01**: The deployed Vercel frontend and Render backend can be tested with real authenticated accounts and real persisted data.
- [x] **PROD-02**: Production chat runtime does not ship fixture, screenshot, or static demo content as if it were real conversation data.
- [x] **PROD-03**: Desktop rails, mobile drawers, overlays, and panels can be opened, closed, escaped, and restored without trapping the user.
- [x] **PROD-04**: Chatify is not called functionally ready until the live deployed product passes the full production acceptance gate.
- [x] **CTRL-01**: Header, rail, and mobile message-search controls open real searchable message workflows.
- [x] **CTRL-02**: More menus expose implemented conversation actions only, with accessible labels, loading states, and recoverable errors.
- [x] **CTRL-03**: Pinned messages, shared files, shared media, and security rows render from server-backed conversation state or disappear when empty.
- [x] **BLOCK-01**: User can block and unblock a direct-message participant from the conversation UI.
- [x] **BLOCK-02**: Blocked state prevents new messages, call attempts, and inappropriate realtime events across HTTP and Socket.IO paths.
- [x] **ID-01**: User identity imagery or abstract identity marks can be changed and persist across sidebar, header, message, and detail surfaces.
- [x] **ID-02**: Identity imagery upload or customization has validation, privacy controls, and fallback behavior.
- [x] **VOICE-01**: User can record, preview, cancel, send, reload, and play voice messages.
- [x] **VOICE-02**: Voice message permission denial, unsupported browsers, network failure, retry, and playback errors are recoverable.
- [x] **CALL-01**: Audio call controls initiate authenticated one-to-one realtime call sessions.
- [x] **CALL-02**: Video call controls initiate authenticated one-to-one realtime video sessions.
- [x] **CALL-03**: Call state covers incoming, outgoing, ringing, connected, rejected, missed, busy, permission-denied, and ended flows.
- [x] **CALL-04**: Call signaling is scoped to authorized direct-message participants and respects blocked-user state.

### Tests And Verification

- [x] **TEST-01**: Backend request tests cover auth lifecycle, CSRF enforcement, message authorization, validation boundaries, and password reset behavior.
- [x] **TEST-02**: Socket integration tests cover authenticated handshake, unauthorized event rejection, room membership, typing, delivery, read, edit, delete, reaction, and reconnect behavior.
- [x] **TEST-03**: Frontend tests cover optimistic send, rollback, duplicate merge, unread updates, session-expired state, and core chat UI states.
- [x] **TEST-04**: Each auth, socket, and message phase has blocking security acceptance criteria and verification evidence.
- [x] **TEST-05**: End-to-end UI quality gates cover real messenger workflows across desktop, mobile, light theme, and dark theme after behavior interactions.

## v2 Requirements

### Username Identity And Privacy

- **V2-USER-01**: New local signups must choose a unique public username that is normalized, validated, indexed, and stored on the user record.
- **V2-USER-02**: Existing authenticated users without a username must complete a mandatory username setup gate before entering chat or using discovery features.
- **V2-USER-03**: Username validation is consistent across database, backend controllers, frontend forms, and tests, including case normalization and duplicate handling.
- **V2-USER-04**: User can start or continue a direct conversation by username instead of email.
- **V2-PRIV-01**: Public identity and discovery surfaces expose username, display name, identity mark, and profile image only; email remains private auth/reset/account data.
- **V2-PRIV-02**: Contact discovery does not expose whether an email exists and does not allow email search.
- **V2-PRIV-03**: Group participant lists, invites, member management, realtime events, logs, traces, and screenshots do not expose member emails.

### Group Conversations

- **V2-GRP-01**: User can create and participate in private group conversations.
- **V2-GRP-02**: Group conversations have a server-enforced membership limit of 3 to 10 users including the creator.
- **V2-GRP-03**: Group admins can manage supported group name, image, description, and membership actions without bypassing authorization or the member cap.
- **V2-GRP-04**: Group messages, unread counts, receipts, typing, reactions, attachments, shared surfaces, and notifications work through the same server-truth reliability model as direct messages.

### Platform Expansion

- **V2-NOTF-01**: User can receive push or email notifications for new messages.
- **V2-MOD-01**: User can report another user and route reports into moderation tooling.
- **V2-ADMIN-01**: Admin can review abuse reports and moderate accounts or content.
- **V2-ADMIN-02**: Admin can triage reports, apply enforcement actions, record reviewer notes, and audit moderation outcomes from a protected UI.
- **V2-E2EE-01**: Users can opt into end-to-end encrypted conversations after storage and delivery tradeoffs are designed.
- **V2-PLAT-01**: Channels or shared spaces are designed as a bounded expansion after private direct and group conversations are reliable.
- **V2-PLAT-02**: Bots and integrations require scoped permissions, audit trails, revocation, and abuse controls before runtime execution.
- **V2-PLAT-03**: External notification delivery respects opt-in preferences, mute/block state, privacy-safe templates, and unsubscribe controls.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile apps | Web-first reconstruction comes before platform expansion. |
| End-to-end encryption implementation | Phase 29 must first settle message storage, key management, recovery, moderation, and notification tradeoffs. |
| Payments or monetization | Not relevant to the approved messenger reconstruction goal. |
| Full Slack/Discord feature parity | Phase 30 may define bounded channels, bots, and integrations; broad clone-style parity remains out of scope. |
| Large admin suite | Phase 31 promotes the first moderation operations workflow; broad tenant/admin operations remain later. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| SEC-04 | Phase 1 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| TEST-01 | Phase 1 | Complete |
| TEST-04 | Phase 1 | Complete |
| RT-01 | Phase 2 | Complete |
| RT-02 | Phase 2 | Complete |
| RT-03 | Phase 2 | Complete |
| RT-04 | Phase 2 | Complete |
| RT-05 | Phase 2 | Complete |
| TEST-02 | Phase 2 | Complete |
| MSG-01 | Phase 3 | Complete |
| MSG-02 | Phase 3 | Complete |
| MSG-03 | Phase 3 | Complete |
| MSG-04 | Phase 3 | Complete |
| MSG-05 | Phase 3 | Complete |
| MSG-06 | Phase 3 | Complete |
| MSG-07 | Phase 3 | Complete |
| DELIV-01 | Phase 10.1 | Complete |
| DELIV-02 | Phase 10.1 | Complete |
| DELIV-03 | Phase 10.1 | Complete |
| DELIV-04 | Phase 10.1 | Complete |
| DELIV-05 | Phase 10.1, Phase 25, Phase 27 | Complete |
| UI-01 | Phase 6 | Complete |
| UI-02 | Phase 6 | Complete |
| UI-03 | Phase 6 | Complete |
| UI-04 | Phase 6 | Complete |
| UI-05 | Phase 6 | Complete |
| UI-06 | Phase 6 | Complete |
| TEST-03 | Phase 4 | Complete |
| BASE-01 | Phase 5 | Complete |
| BASE-02 | Phase 5 | Complete |
| BASE-03 | Phase 5 | Complete |
| BASE-04 | Phase 5 | Complete |
| BASE-05 | Phase 5 | Complete |
| PARITY-01 | Phase 7 | Complete |
| PARITY-02 | Phase 7 | Complete |
| PARITY-03 | Phase 7 | Complete |
| MEDIA-01 | Phase 8 | Complete |
| MEDIA-02 | Phase 8 | Complete |
| MEDIA-03 | Phase 8 | Complete |
| MEDIA-04 | Phase 12, Phase 27 | Complete |
| PROD-01 | Phase 10, Phase 14, Phase 25 | Complete |
| PROD-02 | Phase 10, Phase 14, Phase 25 | Complete |
| PROD-03 | Phase 10, Phase 25 | Complete |
| PROD-04 | Phase 14, Phase 25, Phase 26 | Complete |
| CTRL-01 | Phase 11 | Complete |
| CTRL-02 | Phase 11 | Complete |
| CTRL-03 | Phase 11 | Complete |
| BLOCK-01 | Phase 11 | Complete |
| BLOCK-02 | Phase 11, Phase 13 | Complete |
| ID-01 | Phase 12, Phase 16 | Complete |
| ID-02 | Phase 12, Phase 16 | Complete |
| VOICE-01 | Phase 12, Phase 27 | Complete |
| VOICE-02 | Phase 12, Phase 27 | Complete |
| CALL-01 | Phase 13 | Complete |
| CALL-02 | Phase 13 | Complete |
| CALL-03 | Phase 13 | Complete |
| CALL-04 | Phase 13 | Complete |
| TEST-05 | Phase 9 | Complete |
| V2-USER-01 | Phase 20 | Planned |
| V2-USER-02 | Phase 20 | Planned |
| V2-USER-03 | Phase 20 | Planned |
| V2-USER-04 | Phase 21 | Planned |
| V2-PRIV-01 | Phase 20, Phase 21, Phase 22 | Planned |
| V2-PRIV-02 | Phase 21 | Planned |
| V2-PRIV-03 | Phase 22 | Planned |
| V2-GRP-01 | Phase 22 | Planned |
| V2-GRP-02 | Phase 22 | Planned |
| V2-GRP-03 | Phase 22 | Planned |
| V2-GRP-04 | Phase 22, Phase 24, Phase 25 | Complete |
| V2-NOTF-01 | Phase 30 | Designed; implementation deferred |
| V2-MOD-01 | Phase 28 | Complete |
| V2-ADMIN-01 | Phase 28 | Complete |
| V2-ADMIN-02 | Phase 31 | Planned |
| V2-E2EE-01 | Phase 29 | Designed; implementation deferred |
| V2-PLAT-01 | Phase 30 | Designed; implementation deferred |
| V2-PLAT-02 | Phase 30 | Designed; implementation deferred |
| V2-PLAT-03 | Phase 30 | Designed; implementation deferred |

**Coverage:**

- v1 requirements: 64 total
- Mapped to phases: 64
- Unmapped: 0

---
*Requirements defined: 2026-06-07*
*Last updated: 2026-06-19 after Phase 25 user-confirmed evidence closure and Phase 31 addition*
