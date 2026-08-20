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

### Notification Runtime

- **V2-NOTF-02**: User can manage push and email notification subscriptions, preferences, unsubscribe state, and per-conversation notification behavior.
- **V2-NOTF-03**: Server-side notification delivery uses an observable queue/outbox with privacy-safe templates, retries, rate limits, and sanitized provider outcomes.

### Conversation Organization

- **V2-ORG-01**: User can mute, archive, pin, and favorite conversations as per-user state without changing other participants' conversation state.
- **V2-ORG-02**: User can filter conversations by unread, direct, group, archived, and favorite views without losing selected conversation continuity.

### Advanced Search

- **V2-SEARCH-01**: User can search authorized messages by sender, date range, text, media, file, link, and voice-message filters.
- **V2-SEARCH-02**: User can jump from a search result to the matching message while preserving pagination, visibility, and authorization boundaries.

### Session And Device Security

- **V2-SESS-01**: User can view active sessions and devices with safe device labels, current-session state, and approximate activity metadata.
- **V2-SESS-02**: User can revoke individual sessions and log out everywhere, with HTTP and Socket.IO access revoked consistently.
- **V2-SESS-03**: User can understand suspicious session activity through privacy-preserving notices that do not expose token, cookie, or raw device details.

### Encrypted Conversations

- **V2-E2EE-02**: User can create opt-in encrypted conversations that store encrypted message and attachment payloads separately from standard plaintext conversations.
- **V2-E2EE-03**: Encrypted conversation key setup, backup, rotation, device changes, and lost-access behavior follow the approved Phase 29 design.
- **V2-E2EE-04**: Encrypted conversations expose honest limitations for search, notifications, moderation, reporting, and account recovery.

### Profiles And Presence

- **V2-PROF-01**: User can manage public profile bio, status, and contact-card details with validation and safe fallbacks.
- **V2-PROF-02**: Profile surfaces expose only approved public identity data and never expose private email addresses in discovery or conversation contexts.
- **V2-PRES-01**: User can control online, last-seen, and status visibility without leaking presence to unauthorized users.
- **V2-PRES-02**: Presence privacy remains consistent across reconnects, blocked users, direct chats, group chats, and future spaces.

### Spaces And Channels

- **V2-SPACE-01**: User can create and participate in small private spaces with scoped channels after group messaging remains reliable.
- **V2-SPACE-02**: Space membership, roles, invites, and channel access are server-authorized and private by default.
- **V2-SPACE-03**: Channel messages, unread counts, receipts, attachments, reactions, and notifications use the same server-truth reliability model as direct and group messages.

### Data Privacy And Portability

- **V2-DATA-01**: User can export authorized account, conversation, media, and moderation-visible data in a portable format.
- **V2-DATA-02**: User can request account deletion with clear retention, anonymization, conversation tombstone, and abuse/security exception behavior.
- **V2-DATA-03**: Export, deletion, and retention workflows are authenticated, CSRF-protected, rate-limited, audited, and privacy-preserving.

### Moderation Operations

- **V2-MOD-02**: User can appeal supported enforcement actions and see appeal status through a privacy-safe workflow.
- **V2-ADMIN-03**: Admin can assign reports and appeals, view enforcement history, and manage reviewer workload from protected moderation surfaces.
- **V2-ADMIN-04**: Admin can inspect moderation operations metrics without exposing private messages, emails, tokens, or report internals.

### Localization And RTL

- **V2-I18N-01**: Core account, chat, settings, moderation, notification, and privacy surfaces use translatable strings.
- **V2-I18N-02**: Arabic RTL layout works across desktop and mobile without overlapping controls, clipped text, or broken message alignment.
- **V2-I18N-03**: Dates, times, validation messages, empty states, notification copy, accessibility labels, and keyboard flows respect the selected locale.

### Contact Requests And Trusted Onboarding

- **V2-CONTACT-01**: New one-to-one standard conversations require a pending contact request and recipient acceptance before a new direct chat is created.
- **V2-CONTACT-02**: Users can list, accept, decline, and cancel contact requests through ownership-checked, CSRF-protected, privacy-safe endpoints and UI controls.
- **V2-CONTACT-03**: Contact request workflows use username/public identity only, respect block state, and do not expose private emails in payloads, logs, traces, screenshots, or tests.

### Reply To Message With Quoted Context

- **V2-REPLY-01**: Users can send a standard message that references a visible message in the same conversation, and the reply relationship persists across reloads, sockets, search context, and pagination.
- **V2-REPLY-02**: Quoted context is a bounded, privacy-safe snapshot containing only public sender identity, source message id, source timestamp, message type, attachment count, and a short safe preview when plaintext is allowed.
- **V2-REPLY-03**: Chat UI exposes reply selection, composer preview, quoted bubble display, source jump/fallback states, and mobile/keyboard-accessible cancel behavior without adding thread semantics.

### Per-Conversation Message Drafts

- **V2-DRAFT-01**: Users can keep unsent text drafts separately per accessible conversation, with drafts restored when switching conversations or reloading after authentication initializes.
- **V2-DRAFT-02**: Drafts are local-only, user-scoped, cleared during private session cleanup, and are not sent through backend APIs, Socket.IO events, persistence models, logs, traces, or screenshots beyond explicit visual QA evidence.
- **V2-DRAFT-03**: Sidebar draft indicators are bounded and searchable for standard conversations, while encrypted conversation draft plaintext is hidden behind generic copy and excluded from sidebar search.

### Two-Factor Authentication And Backup Codes

- **V2-2FA-01**: Local-account users can set up TOTP 2FA from Settings after re-entering the current password, confirm with a valid 6-digit code, and receive backup codes exactly once.
- **V2-2FA-02**: Login for a 2FA-enabled account returns a pending challenge without setting access or refresh cookies until a valid TOTP or unused backup code is submitted.
- **V2-2FA-03**: Backup codes are single-use, stored only as hashes, and visible only immediately after generation.
- **V2-2FA-04**: Users can view 2FA status, remaining backup-code count, disable 2FA, and regenerate backup codes from Settings with password and second-factor verification.
- **V2-2FA-05**: TOTP secrets are encrypted at rest, 2FA endpoints are CSRF protected/rate limited through the existing auth route boundary, and responses/logs never expose raw secrets except the one-time setup payload.
- **V2-2FA-06**: Backend and frontend tests cover setup, challenge login, backup-code use, disable/regeneration, and UI error/loading states.

### Group And Space Mentions

- **V2-MENTION-01**: Users can send standard group and space-channel messages that mention eligible conversation members using visible `@username` tokens.
- **V2-MENTION-02**: Mention metadata is validated server-side against authenticated chat membership, rejects self/non-member/hidden targets, and stores only bounded public identity snapshots.
- **V2-MENTION-03**: Direct chats and encrypted conversations do not accept mention metadata and treat raw `@username` text as ordinary message text.
- **V2-MENTION-04**: The composer suggests eligible group or space members, excludes the current user, supports keyboard and pointer insertion, and stays responsive on desktop and mobile.
- **V2-MENTION-05**: Persisted message mentions render as inline highlights, including a distinct current-user mention state, without exposing private emails or profile metadata.
- **V2-MENTION-06**: Send, retry, idempotency, edit pruning, cache merging, reload, group, space, direct, encrypted, hidden, and non-member paths are covered by focused tests and visual QA.

### Expiring And Revokable Invite Links

- **V2-INVITE-01**: Authorized group admins and space owners/admins can create invite links with preset expiry and max-use limits.
- **V2-INVITE-02**: Invite tokens are generated with high entropy, stored only as hashes, returned only once on creation, and never included in list/revoke responses, logs, tests, or screenshots.
- **V2-INVITE-03**: Invite links can be listed and revoked by authorized managers, with metadata-only active/revoked/expired/exhausted states.
- **V2-INVITE-04**: Joining by invite enforces target membership rules, block boundaries, group/space member caps, expiry, revocation, and atomic max-use limits while treating already-members as success without consuming a use.
- **V2-INVITE-05**: Direct chats and encrypted conversations do not expose invite-link creation or join behavior.
- **V2-INVITE-06**: Invite management and protected invite-join flows are covered by focused backend/frontend tests and visual QA across desktop, tablet, and mobile.

### Saved Messages And Bookmarks

- **V2-SAVED-01**: Users can save and unsave visible messages as private per-user state without changing shared message or conversation state.
- **V2-SAVED-02**: Saving, unsaving, listing, and jumping to saved messages respect existing membership, delete-for-self, and deleted-for-everyone visibility rules.
- **V2-SAVED-03**: Users can open a saved-message surface that lists saved entries newest-first with safe conversation, sender, preview, and saved-time context.
- **V2-SAVED-04**: Message actions expose save/unsave for eligible visible messages and show requester-specific saved state in the chat UI.
- **V2-SAVED-05**: Saved-message previews never expose encrypted plaintext, hidden/deleted content, private emails, tokens, or non-public identity data.
- **V2-SAVED-06**: Saved-message workflows are covered by focused backend tests, frontend API/query/component tests, lint/build verification, and visual QA evidence.

### Delivery Health Dashboard

- **V2-DELIVERY-HEALTH-01**: Admins can open a protected delivery-health dashboard backed by an admin-only aggregate diagnostics API.
- **V2-DELIVERY-HEALTH-02**: Diagnostics report bounded 1h, 24h, and 7d message lifecycle metrics for sent, delivered, read, stale sent, stale delivered, delivery rate, and read rate while excluding call activity.
- **V2-DELIVERY-HEALTH-03**: Diagnostics surface metadata-only conversation risk rows with conversation id, kind, member count, recent count, stale counts, unread estimate, latest activity, and high-level flags.
- **V2-DELIVERY-HEALTH-04**: Diagnostics include Socket.IO runtime status and notification outbox status/channel counts without serializing notification payload bodies.
- **V2-DELIVERY-HEALTH-05**: The dashboard supports loading, empty, error, non-admin, refresh, desktop, mobile, and RTL states using the existing chat theme and localization system.
- **V2-DELIVERY-HEALTH-06**: Delivery-health workflows are covered by focused backend tests, frontend API/hook/page tests, lint/build verification, and browser visual QA evidence that proves private content is not exposed.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile apps | Web-first reconstruction comes before platform expansion. |
| Default end-to-end encryption for all existing conversations | Phase 36 scopes E2EE as an opt-in conversation mode; retroactive migration of all existing plaintext conversations and Signal-grade parity remain out of scope. |
| Payments or monetization | Not relevant to the approved messenger reconstruction goal. |
| Full Slack/Discord feature parity | Phase 38 scopes small private spaces/channels only; broad clone-style parity remains out of scope. |
| Broad tenant/admin suite | Phases 31 and 40 cover moderation operations; tenant administration, billing, and organization-wide governance remain later. |

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
| V2-USER-01 | Phase 20 | Complete |
| V2-USER-02 | Phase 20 | Complete |
| V2-USER-03 | Phase 20 | Complete |
| V2-USER-04 | Phase 21 | Complete |
| V2-PRIV-01 | Phase 20, Phase 21, Phase 22 | Complete |
| V2-PRIV-02 | Phase 21 | Complete |
| V2-PRIV-03 | Phase 22 | Complete |
| V2-GRP-01 | Phase 22 | Complete |
| V2-GRP-02 | Phase 22 | Complete |
| V2-GRP-03 | Phase 22 | Complete |
| V2-GRP-04 | Phase 22, Phase 23, Phase 24, Phase 25 | Complete |
| V2-NOTF-01 | Phase 30, Phase 32 | Complete |
| V2-MOD-01 | Phase 28 | Complete |
| V2-ADMIN-01 | Phase 28 | Complete |
| V2-ADMIN-02 | Phase 31 | Complete |
| V2-E2EE-01 | Phase 29, Phase 36 | Complete |
| V2-PLAT-01 | Phase 30, Phase 38 | Complete |
| V2-PLAT-02 | Phase 30 | Designed; implementation deferred |
| V2-PLAT-03 | Phase 30, Phase 32 | Complete |
| V2-NOTF-02 | Phase 32 | Complete |
| V2-NOTF-03 | Phase 32 | Complete |
| V2-ORG-01 | Phase 33 | Complete |
| V2-ORG-02 | Phase 33 | Complete |
| V2-SEARCH-01 | Phase 34 | Complete |
| V2-SEARCH-02 | Phase 34 | Complete |
| V2-SESS-01 | Phase 35 | Complete |
| V2-SESS-02 | Phase 35 | Complete |
| V2-SESS-03 | Phase 35 | Complete |
| V2-E2EE-02 | Phase 36 | Complete for encrypted text payloads; encrypted attachments remain deferred |
| V2-E2EE-03 | Phase 36 | Complete for device-local secret scope; backup, rotation, and cross-device recovery remain deferred |
| V2-E2EE-04 | Phase 36 | Complete |
| V2-PROF-01 | Phase 37 | Complete |
| V2-PROF-02 | Phase 37 | Complete |
| V2-PRES-01 | Phase 37 | Complete |
| V2-PRES-02 | Phase 37 | Complete |
| V2-SPACE-01 | Phase 38 | Complete |
| V2-SPACE-02 | Phase 38 | Complete |
| V2-SPACE-03 | Phase 38 | Complete |
| V2-DATA-01 | Phase 39 | Complete |
| V2-DATA-02 | Phase 39 | Complete for request/retention contract; deletion worker remains operational hardening |
| V2-DATA-03 | Phase 39 | Complete |
| V2-MOD-02 | Phase 40 | Complete |
| V2-ADMIN-03 | Phase 40 | Complete |
| V2-ADMIN-04 | Phase 40 | Complete |
| V2-I18N-01 | Phase 41 | Complete for locale foundation and representative account/chat/settings/moderation/privacy surfaces; remaining legacy copy can migrate incrementally |
| V2-I18N-02 | Phase 41 | Complete for tested Settings/admin RTL document direction and message text bidi; full screenshot matrix remains release-candidate work |
| V2-I18N-03 | Phase 41 | Complete for locale provider, Settings/admin dates, language switching, and tested accessibility labels; native translation review remains recommended |
| V2-CONTACT-01 | Phase 42 | Complete |
| V2-CONTACT-02 | Phase 42 | Complete |
| V2-CONTACT-03 | Phase 42 | Complete |
| V2-REPLY-01 | Phase 43 | Complete |
| V2-REPLY-02 | Phase 43 | Complete |
| V2-REPLY-03 | Phase 43 | Complete |
| V2-DRAFT-01 | Phase 44 | Complete |
| V2-DRAFT-02 | Phase 44 | Complete |
| V2-DRAFT-03 | Phase 44 | Complete |
| V2-2FA-01 | Phase 45 | Complete |
| V2-2FA-02 | Phase 45 | Complete |
| V2-2FA-03 | Phase 45 | Complete |
| V2-2FA-04 | Phase 45 | Complete |
| V2-2FA-05 | Phase 45 | Complete |
| V2-2FA-06 | Phase 45 | Complete |
| V2-MENTION-01 | Phase 46 | Complete |
| V2-MENTION-02 | Phase 46 | Complete |
| V2-MENTION-03 | Phase 46 | Complete |
| V2-MENTION-04 | Phase 46 | Complete |
| V2-MENTION-05 | Phase 46 | Complete |
| V2-MENTION-06 | Phase 46 | Complete |
| V2-INVITE-01 | Phase 47 | Complete |
| V2-INVITE-02 | Phase 47 | Complete |
| V2-INVITE-03 | Phase 47 | Complete |
| V2-INVITE-04 | Phase 47 | Complete |
| V2-INVITE-05 | Phase 47 | Complete |
| V2-INVITE-06 | Phase 47 | Complete |
| V2-SAVED-01 | Phase 48 | Complete |
| V2-SAVED-02 | Phase 48 | Complete |
| V2-SAVED-03 | Phase 48 | Complete |
| V2-SAVED-04 | Phase 48 | Complete |
| V2-SAVED-05 | Phase 48 | Complete |
| V2-SAVED-06 | Phase 48 | Complete |
| V2-DELIVERY-HEALTH-01 | Phase 49 | Complete |
| V2-DELIVERY-HEALTH-02 | Phase 49 | Complete |
| V2-DELIVERY-HEALTH-03 | Phase 49 | Complete |
| V2-DELIVERY-HEALTH-04 | Phase 49 | Complete |
| V2-DELIVERY-HEALTH-05 | Phase 49 | Complete |
| V2-DELIVERY-HEALTH-06 | Phase 49 | Complete |

**Coverage:**

- v1 requirements: 64 total
- Mapped to phases: 64
- Unmapped: 0
- post-v1/v2 requirements: 86 total
- post-v1/v2 mapped to phases: 86
- post-v1/v2 planned future implementation requirements: 3

---
*Requirements defined: 2026-06-07*
*Last updated: 2026-06-30 after completing Phase 49 delivery health dashboard*
