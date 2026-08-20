# Chatify Repository Threat Model

## Overview

Chatify is a browser-based MERN messaging system that combines cookie-authenticated HTTP APIs, Socket.IO real-time delivery and calling, MongoDB/GridFS persistence, OAuth login, notification delivery, integrations, moderation, and privacy operations.

### Security objectives

- Bind every privileged operation to a server-verified user, session, administrator, or scoped integration identity.
- Keep messages, attachments, social graphs, presence, calls, moderation records, and privacy records confidential to authorized principals.
- Preserve message and account integrity across retries, concurrent sockets, background workers, token rotation, and provider callbacks.
- Prevent browser-origin attacks, cross-site request forgery, cross-room Socket.IO access, injection, unsafe uploads, and attacker-directed outbound requests.
- Keep authentication, integration, encryption, notification, TURN, database, CI, and deployment secrets out of clients, logs, generated evidence, and repository history.
- Maintain availability through bounded payloads, rate limits, queues, idempotency, worker leases, and graceful degradation of third-party providers.
- Make security-relevant architectural drift visible when a route, Socket.IO event, model, worker, or external provider is added.

### Included repository scope

- Backend Express application, controllers, middleware, models, services, utilities, and Socket.IO runtime under Backend/Chatify.
- Frontend React application, API clients, Socket.IO client, service worker, browser storage, and production browser configuration under Frontend/Chatify.
- MongoDB and GridFS data accessed by the application, including account, session, message, attachment, integration, notification, moderation, and privacy collections.
- OAuth, email, web-push, STUN/TURN, integration-client, GitHub Actions, deployment configuration, and operator-secret trust boundaries represented in the repository.
- Repository workflows and operational scripts when they consume privileged credentials or produce release/security evidence.

### Explicit exclusions

- Compromise of an end-user operating system, browser binary, hardware, or already-unlocked device.
- A fully malicious or compromised MongoDB, OAuth, email, push, STUN/TURN, cloud, DNS, certificate-authority, or hosting provider acting outside its documented contract.
- Social engineering, credential phishing, SIM swapping, and physical attacks that do not exploit Chatify code or deployment configuration.
- Cryptographic proof of browser WebRTC, TLS, Argon2, JWT, AES-GCM, and third-party library primitives; misuse and integration of those primitives remain in scope.
- Production network controls, secret stores, backups, firewall rules, and provider-console settings that are not represented by repository evidence; unsafe repository assumptions about them remain in scope.

The model is derived from Phase 1 runtime-surface SHA-256 `041f4923078281d523011e157011f7e747159798008fec12a49b9c0f303ae949`, covering 116 HTTP routes, 67 Socket.IO registrations, 22 data models, and 9 external-provider groups. File-only audit and documentation changes do not alter this digest. It is a repository-scoped threat model, not a vulnerability report.

## Threat Model, Trust Boundaries, and Assumptions

### Actors

| ID | Actor | Control | Capabilities |
| --- | --- | --- | --- |
| unauthenticated-internet-user | Unauthenticated internet user | attacker-controlled | Send arbitrary public HTTP requests; Initiate OAuth and password-reset flows; Probe health, readiness, queue, CSRF, and authentication surfaces |
| authenticated-user | Authenticated user | attacker-controlled | Send cookie-authenticated HTTP requests; Open authenticated Socket.IO connections; Choose route parameters, message content, uploads, profile data, and protocol payloads |
| conversation-peer | Conversation or channel member | attacker-controlled | Observe content and metadata intentionally shared with a conversation; Send messages, reactions, read/delivery state, typing state, and call signaling when authorized |
| group-space-manager | Group or space manager | attacker-controlled | Manage membership, invite links, roles, and conversation settings within server-authorized scope |
| administrator | Chatify administrator or moderator | operator-controlled | Use admin and moderation endpoints; Review redacted reports, privacy operations, integration diagnostics, and delivery health |
| integration-client | Third-party integration client | attacker-controlled | Present a bearer integration token; Call the integration runtime manifest within granted installation scope |
| external-identity-provider | OAuth identity provider | third-party-controlled | Return provider identities and callback parameters; Host provider profile images and authorization responses |
| delivery-provider | Email or push delivery provider | third-party-controlled | Receive minimized notification payloads and delivery credentials; Return provider status and errors |
| network-peer | WebRTC peer and STUN/TURN service | third-party-controlled | Exchange bounded signaling metadata and relay media connectivity; Observe network metadata inherent to WebRTC |
| operator-ci-developer | Operator, CI workflow, or repository developer | developer-controlled | Change code and workflows; Configure deployment origins and secrets; Run migrations, tests, audits, and release evidence |
| malicious-web-origin | Malicious web origin | attacker-controlled | Cause a victim browser to send cross-origin requests; Attempt cross-site Socket.IO handshakes and CSRF |

### Assets and protected data

| ID | Asset | Data classes | Required invariants |
| --- | --- | --- | --- |
| account-identity | Accounts, identities, and public profiles | public-profile, account-pii, auth-secrets | INV-IDENTITY-SOURCE, INV-ACCOUNT-LINKING, INV-OUTPUT-MINIMIZATION |
| authentication-session | Authentication, MFA, password reset, cookies, and sessions | auth-secrets, session-device-metadata | INV-ACTIVE-SESSION, INV-TOKEN-ROTATION, INV-CSRF, INV-COOKIE-BOUNDARY, INV-RESET-MFA |
| conversation-messaging | Chats, messages, calls, reactions, and delivery state | conversation-content, encrypted-message-material, social-graph-presence | INV-RESOURCE-AUTHORIZATION, INV-SOCKET-ROOM-AUTHORIZATION, INV-SOCKET-PAYLOADS, INV-E2EE-CONTRACT |
| media-storage | Attachments, voice content, and profile-image storage | media-attachments, conversation-content | INV-STORAGE-AUTHORIZATION, INV-UPLOAD-VALIDATION, INV-OUTPUT-MINIMIZATION |
| social-spaces | Contacts, spaces, groups, membership, invites, blocks, and presence | public-profile, social-graph-presence | INV-RESOURCE-AUTHORIZATION, INV-ROLE-AUTHORIZATION, INV-PRIVACY-MINIMIZATION |
| moderation-privacy | Moderation, safety, privacy exports, deletion, and retention | moderation-safety, privacy-operations, account-pii, conversation-content | INV-ADMIN-AUTHORIZATION, INV-PRIVACY-LIFECYCLE, INV-AUDIT-REDACTION |
| integrations | Integration applications, installations, runtime access, and audit logs | integration-credentials-audit, account-pii | INV-INTEGRATION-TOKENS, INV-RESOURCE-AUTHORIZATION, INV-AUDIT-REDACTION |
| notifications | Notification preferences, outbox jobs, email, and push delivery | notification-contact-data, conversation-content, social-graph-presence | INV-NOTIFICATION-PRIVACY, INV-WORKER-IDEMPOTENCY, INV-OUTBOUND-DESTINATIONS |
| operations-control-plane | Runtime configuration, logs, health, queues, CI, and deployment evidence | operational-telemetry, configuration-ci-secrets | INV-SECRET-HANDLING, INV-AUDIT-REDACTION, INV-AVAILABILITY, INV-ORIGIN-ALIGNMENT |

### Trust boundaries

| ID | Boundary | Flow | Channels | Existing controls | Assumptions |
| --- | --- | --- | --- | --- | --- |
| BOUNDARY-PUBLIC-HTTP | Public internet and browser to HTTP edge | browser-client → http-edge | HTTPS | Helmet headers; CORS allowlist; global and route-specific rate limits; bounded JSON and URL-encoded bodies; sanitization and HPP; request logging | TLS and forwarded-host/protocol metadata are supplied only by authorized hosting proxies; Production FRONTEND_ORIGIN identifies the only browser origin allowed to send credentialed requests |
| BOUNDARY-COOKIE-HTTP | Cookie-authenticated browser to Express authorization boundary | http-edge → http-runtime | HTTP requests carrying access/refresh cookies and CSRF headers | JWT verification; active-session claim validation; signed double-submit CSRF token; route middleware; resource membership and ownership checks | Controllers do not trust user identifiers from request bodies when a verified identity exists; Mutating cookie-authenticated routes remain behind csrfProtection |
| BOUNDARY-SOCKET | Browser to Socket.IO handshake and event boundary | browser-client → socket-runtime | WSS or trusted same-origin proxy transport | Origin allowlist; cookie access-token verification; active-session validation; per-event rate windows; bounded call signaling; chat and message membership checks; room-scoped and user-scoped emission | A shared adapter and shared presence/rate state are introduced before horizontal Socket.IO scaling; Every new client-to-server event receives explicit authentication, validation, authorization, and abuse controls |
| BOUNDARY-DATABASE | Application runtime to MongoDB and GridFS | http-runtime → database-gridfs | MongoDB protocol | Mongoose schemas and indexes; hashing and encryption of selected secrets; private-field selection; application-level membership checks; TTL and lifecycle workers | Database credentials are operator-controlled secrets; MongoDB network access is restricted to authorized application and operations identities |
| BOUNDARY-OAUTH | Application and browser to OAuth providers | http-runtime → oauth-providers | HTTPS redirects and callbacks | Passport strategies; state and handoff records; provider-specific identifiers; server-controlled callback and frontend destinations | Provider TLS and identity assertions are valid; Account linking requires an explicit server-side identity decision rather than trusting profile email alone |
| BOUNDARY-DELIVERY | Application to email and web-push providers | http-runtime → delivery-providers | HTTPS provider API and Web Push | Outbox deduplication; notification preferences; privacy-minimized templates; hashed endpoint identity; dry-run/test mode; sanitized provider errors | Provider credentials are stored outside the repository; Notification payloads do not contain message previews unless a future reviewed policy explicitly permits them |
| BOUNDARY-WEBRTC | Browser and Socket.IO signaling to STUN/TURN and peers | browser-client → stun-turn-peers | Socket.IO signaling, STUN/TURN, WebRTC media | Chat membership checks; call-session state machine; participant targeting; bounded SDP and ICE fields; event rate limits; operator-controlled ICE configuration | TURN credentials and relay policies are appropriately short-lived or scoped in production; Media confidentiality relies on WebRTC transport and endpoint security |
| BOUNDARY-INTEGRATION-RUNTIME | Integration client to runtime API | integration-clients → http-runtime | HTTPS bearer token | Dedicated integrationRuntimeAuth middleware; hashed installation tokens; scopes; rotation and revocation; runtime rate limiting; integration audit logs | Bearer tokens are transmitted only over TLS and are not embedded in browser URLs or logs; Every future runtime operation checks installation scope in addition to token validity |
| BOUNDARY-SERVICE-WORKER | Push provider and service worker to browser UI | delivery-providers → service-worker | Web Push and browser notification APIs | VAPID authentication; subscription ownership; privacy-minimized payloads; notification click routing | The browser enforces service-worker origin isolation; Notification content remains generic and does not expose conversation text on a locked device |
| BOUNDARY-CI-OPERATOR | Developer and CI control plane to repository and deployment | ci-operator → http-runtime | Git commits and pull requests, GitHub Actions, deployment configuration and secret injection | Read-only audit workflows; pinned action revisions for security workflows; clean installs; tests, lint, build, operations and evidence gates; secret scanning in operations checks | Branch protection and secret permissions are configured outside this repository; Workflow changes receive privileged review before deployment |

### Data flows

| ID | Flow | Zones | Data classes | Controls | Failure modes |
| --- | --- | --- | --- | --- | --- |
| FLOW-LOCAL-AUTH | Signup, login, MFA challenge, refresh, logout, and session management | browser-client → http-runtime | account-pii, auth-secrets, session-device-metadata | Argon2 password hashing; JWT access tokens; hashed refresh tokens; active session records; MFA challenges and encrypted TOTP secrets; rate limiting and CSRF | Account takeover; session fixation or replay; MFA bypass; credential or reset-token disclosure |
| FLOW-OAUTH | OAuth authorization, callback, handoff, account linking, and finalization | browser-client → oauth-providers | account-pii, auth-secrets, session-device-metadata | Provider-specific identifiers; server-stored OAuth handoff; controlled callback routes; session issuance only after server-side finalization | Account confusion or takeover; open redirect; OAuth state replay; provider-profile data overexposure |
| FLOW-PASSWORD-RESET | Password-reset request, code verification, and password replacement | browser-client → delivery-providers | account-pii, auth-secrets, notification-contact-data | Non-enumerating response; hashed reset token; expiry and one-time use; rate limiting; sanitized delivery errors | Account takeover; account enumeration; reset-code brute force or replay; secret leakage through email or logs |
| FLOW-MESSAGE-HTTP | Chat, message, attachment, reaction, read, delivery, pin, save, search, and mutation APIs | browser-client → database-gridfs | conversation-content, encrypted-message-material, media-attachments, social-graph-presence | Protected routes; chat and message membership checks; idempotent client message IDs; bounded text and upload parsing; protected attachment preview and download | IDOR across conversations; stored XSS or unsafe file delivery; message tampering; plaintext leakage from encrypted chats; resource exhaustion |
| FLOW-SOCKET-MESSAGING | Socket authentication, room membership, presence, typing, delivery, unread, and conversation events | browser-client → socket-runtime | conversation-content, social-graph-presence, session-device-metadata | Cookie JWT and active-session handshake; origin validation; membership checks; room- and user-targeted emission; per-event rate limits; deprecated direct message send | Unauthorized room access; cross-user event delivery; presence leakage; event flood or unbounded payload; revoked session remaining connected |
| FLOW-CALLS | Audio/video call session creation, participant targeting, signaling, timeout, and activity persistence | browser-client → stun-turn-peers | conversation-content, social-graph-presence, session-device-metadata | Call-session state machine; participant and block checks; bounded SDP/ICE fields; rate limits; operator-controlled ICE configuration; metadata-only call activity | Call signaling injection; ringing unauthorized users; TURN credential abuse; SDP/ICE memory exhaustion; call metadata leakage |
| FLOW-SPACES-INVITES | Contact requests, spaces, groups, membership, blocks, organization state, and invite links | browser-client → database-gridfs | public-profile, social-graph-presence, conversation-content | Owner/admin role checks; membership constraints; hashed invite tokens; expiry and maximum use counts; block enforcement; authorized socket fanout | Unauthorized membership or role escalation; invite replay or race; contact graph enumeration; blocked-user activity bypass |
| FLOW-MODERATION-PRIVACY | Reports, moderation review, appeals, privacy exports, deletion, and lifecycle workers | browser-client → database-gridfs | moderation-safety, privacy-operations, account-pii, conversation-content | Admin and requester authorization; redacted report context; metadata-only operational views; reversible pending deletion period; idempotent workers and evidence | Unauthorized review or enforcement; privacy export of another user; incomplete deletion; sensitive evidence leakage; worker double processing |
| FLOW-INTEGRATIONS | Integration registration, installation, token issuance, rotation, revocation, runtime access, and audit | integration-clients → http-runtime | integration-credentials-audit, account-pii | Authenticated installation management; hashed bearer tokens; scope validation; rotation and revocation; runtime limiter; audit log | Token disclosure or replay; scope escalation; cross-installation access; unaudited token lifecycle; runtime abuse |
| FLOW-NOTIFICATIONS | Notification preferences, outbox enqueue, delivery worker, email, push, and unsubscribe | http-runtime → delivery-providers | notification-contact-data, conversation-content, social-graph-presence | Server-owned preferences; no message preview mode; outbox dedupe; endpoint hashing; provider error sanitization; dry-run mode | Private message content in notifications; delivery to stale or foreign endpoint; duplicate notification storms; provider credential exposure |
| FLOW-OPERATIONS | Health, readiness, queues, logs, diagnostics, CI, and release evidence | ci-operator → http-runtime | operational-telemetry, configuration-ci-secrets, moderation-safety, privacy-operations, integration-credentials-audit | Cheap health endpoint; sanitized readiness components; admin diagnostics; structured redacted logging; clean-install CI and evidence artifacts | Secret or PII logging; sensitive diagnostics exposed publicly; untrusted workflow execution; release despite failed security gates |

### Security invariants

| ID | Invariant | Severity if broken | Repository evidence |
| --- | --- | --- | --- |
| INV-IDENTITY-SOURCE | HTTP and Socket.IO identities must come only from verified credentials and server-side session claims; client-supplied user identifiers cannot select the acting principal. | critical | Backend/Chatify/Middlewares/protectRoutes.mjs, Backend/Chatify/Config/socket.mjs, Backend/Chatify/Utils/authToken.mjs, Backend/Chatify/Utils/sessionMetadata.mjs |
| INV-ACTIVE-SESSION | Every access token and authenticated socket must carry a session identifier that still belongs to the user and remains active; revocation must terminate future access and notify connected clients. | critical | Backend/Chatify/Middlewares/protectRoutes.mjs, Backend/Chatify/Config/socket.mjs, Backend/Chatify/Models/sessionModel.mjs |
| INV-TOKEN-ROTATION | Refresh tokens are hashed at rest, rotated on use, linked to one session, and rejected after revocation, replacement, expiry, or reuse. | critical | Backend/Chatify/Models/sessionModel.mjs, Backend/Chatify/Controller/authController.mjs, Backend/Chatify/Utils/authToken.mjs |
| INV-COOKIE-BOUNDARY | Authentication cookies are HttpOnly, Secure in production, appropriately SameSite-scoped for the deployment topology, bounded by path and lifetime, and cleared consistently. | high | Backend/Chatify/Utils/tokenCookieGenerator.mjs, Backend/Chatify/Controller/authController.mjs |
| INV-CSRF | Every unsafe cookie-authenticated HTTP operation requires a valid signed double-submit CSRF token, while CORS and origin configuration admit only the intended frontend. | high | Backend/Chatify/Middlewares/csrfProtection.mjs, Backend/Chatify/app.mjs, Frontend/Chatify/src/api/axios.ts |
| INV-ACCOUNT-LINKING | OAuth identities link to accounts only through explicit provider identifiers and safe server-side handoff state; provider profile email alone cannot silently merge identities. | critical | Backend/Chatify/Config/passport.mjs, Backend/Chatify/Utils/oauthConfig.mjs, Backend/Chatify/Models/oauthHandoffModel.mjs, Backend/Chatify/Controller/authController.mjs |
| INV-RESET-MFA | Password reset and MFA challenges are non-enumerating, short-lived, rate-limited, one-time, cryptographically protected, and invalidate or rotate affected sessions after sensitive changes. | critical | Backend/Chatify/Models/passwordResetModel.mjs, Backend/Chatify/Models/twoFactorChallengeModel.mjs, Backend/Chatify/Utils/twoFactor.mjs, Backend/Chatify/Controller/authController.mjs |
| INV-RESOURCE-AUTHORIZATION | Every resource identifier supplied by a user or integration is re-authorized server-side for ownership, membership, visibility, and current block or enforcement state at the operation that uses it. | high | Backend/Chatify/Utils/chatAccess.mjs, Backend/Chatify/Utils/conversationControls.mjs, Backend/Chatify/Controller/messageController.mjs, Backend/Chatify/Controller/chatController.mjs |
| INV-ROLE-AUTHORIZATION | Group, space, moderation, and administrative actions use server-side role state; role fields are not writable or readable through ordinary user payloads. | critical | Backend/Chatify/Middlewares/requireAdmin.mjs, Backend/Chatify/Routes/adminRouter.mjs, Backend/Chatify/Models/userModel.mjs, Backend/Chatify/Controller/spaceController.mjs |
| INV-ADMIN-AUTHORIZATION | Admin diagnostics, moderation review, enforcement, and aggregate privacy/integration operations require a verified active session plus an administrator role and disclose only the minimum operational data. | critical | Backend/Chatify/Routes/adminRouter.mjs, Backend/Chatify/Middlewares/requireAdmin.mjs, Backend/Chatify/Controller/adminController.mjs |
| INV-SOCKET-ORIGIN | Production Socket.IO handshakes accept only the configured frontend origin or a trusted same-origin proxy request and never treat absence of Origin as trusted by default. | high | Backend/Chatify/Config/socket.mjs |
| INV-SOCKET-ROOM-AUTHORIZATION | Joining, leaving, reading, delivering, typing, calling, and receiving Socket.IO events are scoped to verified chat membership or explicit user targeting; room identifiers alone confer no authority. | high | Backend/Chatify/Config/socket.mjs, Backend/Chatify/Utils/chatAccess.mjs, Backend/Chatify/Utils/callSessionState.mjs |
| INV-SOCKET-PAYLOADS | Every client-to-server Socket.IO event has a bounded schema, authorization decision, sanitized error, and explicit event-rate budget; direct message persistence remains on the HTTP path. | high | Backend/Chatify/Config/socket.mjs, Backend/Chatify/Utils/callSocketContract.mjs |
| INV-E2EE-CONTRACT | Encrypted conversations store and return encrypted envelopes and metadata without substituting plaintext content or leaking key material through server logs, search, previews, notifications, or moderation paths. | critical | Backend/Chatify/Models/messageModel.mjs, Backend/Chatify/Utils/messageState.mjs, Frontend/Chatify/src/utils/encryptedMessages.ts |
| INV-STORAGE-AUTHORIZATION | Attachment and profile-image storage identifiers are private implementation details; preview, download, replacement, and deletion paths authorize the requester and return safe content headers. | high | Backend/Chatify/Services/attachmentStorageService.mjs, Backend/Chatify/Services/profileImageStorageService.mjs, Backend/Chatify/Controller/messageController.mjs, Backend/Chatify/Controller/userController.mjs |
| INV-UPLOAD-VALIDATION | Uploads are size-limited, count-limited, MIME- and magic-byte validated, normalized to server-owned metadata, and never executed or served as active content. | high | Backend/Chatify/Middlewares/uploadMessageAttachments.mjs, Backend/Chatify/Services/attachmentStorageService.mjs, Backend/Chatify/Controller/userController.mjs |
| INV-OUTPUT-MINIMIZATION | API, socket, export, moderation, notification, and log serializers omit passwords, hashes, provider IDs, roles, raw push subscriptions, storage IDs, internal errors, and unrelated peer PII. | high | Backend/Chatify/Models/userModel.mjs, Backend/Chatify/Utils/messageState.mjs, Backend/Chatify/Utils/observabilityLogger.mjs, Backend/Chatify/Services/privacyOperationsService.mjs |
| INV-PRIVACY-MINIMIZATION | Presence, last-seen, profile status, contact graph, membership, and conversation metadata honor privacy settings and are disclosed only to users with a current relationship or authorization. | medium | Backend/Chatify/Models/userModel.mjs, Backend/Chatify/Config/socket.mjs, Backend/Chatify/Controller/userController.mjs |
| INV-INTEGRATION-TOKENS | Integration tokens are high-entropy bearer secrets shown only when issued, stored only as hashes, scoped to an installation, rotated and revoked atomically, rate-limited, and represented in audit records. | critical | Backend/Chatify/Middlewares/integrationRuntimeAuth.mjs, Backend/Chatify/Utils/integrationPermissions.mjs, Backend/Chatify/Models/integrationInstallationModel.mjs, Backend/Chatify/Models/integrationAuditLogModel.mjs |
| INV-NOTIFICATION-PRIVACY | Email, push, browser notifications, and provider logs contain generic or explicitly consented content only; message previews, peer email, endpoint secrets, and encrypted plaintext are excluded. | high | Backend/Chatify/Services/notificationService.mjs, Backend/Chatify/Utils/notificationPreferences.mjs, Frontend/Chatify/public/sw.js |
| INV-WORKER-IDEMPOTENCY | Notification and privacy workers claim work safely, deduplicate operations, tolerate retries, preserve terminal state, and cannot process the same irreversible operation twice. | high | Backend/Chatify/Services/notificationService.mjs, Backend/Chatify/Services/privacyOperationsService.mjs, Backend/Chatify/Models/notificationOutboxModel.mjs |
| INV-PRIVACY-LIFECYCLE | Privacy exports and deletion requests are requester-bound, auditable, retention-aware, reversible only during the documented grace period, and complete across account-owned data without exposing other users. | high | Backend/Chatify/Services/privacyOperationsService.mjs, Backend/Chatify/Models/privacyRequestModel.mjs, Backend/Chatify/Models/privacyOperationRunModel.mjs |
| INV-OUTBOUND-DESTINATIONS | Outbound HTTP, OAuth, email, push, database, and ICE destinations come from reviewed operator configuration or fixed provider endpoints, not user-controlled request values; requests use appropriate timeout, redirect, size, TLS, and error controls. | high | Backend/Chatify/Services/emailService.mjs, Backend/Chatify/Services/notificationService.mjs, Backend/Chatify/Utils/callIceConfig.mjs, Backend/Chatify/Config/DBConfig.mjs |
| INV-SECRET-HANDLING | Secrets remain in approved environment or CI secret stores, are never committed or emitted to generated evidence, and are redacted from logs and provider errors. | critical | Backend/Chatify/.env.example, Frontend/Chatify/.env.example, scripts/ops-check.mjs, scripts/security/lib/inventory.mjs |
| INV-AUDIT-REDACTION | Security-relevant actions are observable with stable event names and actor/resource metadata while tokens, cookies, message content, provider payloads, raw endpoints, and unrelated PII are redacted. | medium | Backend/Chatify/Utils/observabilityLogger.mjs, Backend/Chatify/Middlewares/requestLogger.mjs, Backend/Chatify/Models/integrationAuditLogModel.mjs, Backend/Chatify/Models/abuseReportModel.mjs |
| INV-AVAILABILITY | Public, authenticated, socket, upload, search, notification, integration, and administrative workloads have bounded request sizes, concurrency, retry, rate, and queue behavior and fail closed without unbounded memory growth. | high | Backend/Chatify/app.mjs, Backend/Chatify/Middlewares/rateLimiters.mjs, Backend/Chatify/Middlewares/queueMiddleware.mjs, Backend/Chatify/Config/socket.mjs |
| INV-ORIGIN-ALIGNMENT | HTTP CORS, Socket.IO origin checks, cookie SameSite/Secure settings, OAuth callbacks, frontend API/socket origins, and deployment URLs describe one authorized topology and fail closed when production origins are absent or inconsistent. | high | Backend/Chatify/app.mjs, Backend/Chatify/Config/socket.mjs, Backend/Chatify/Config/passport.mjs, Backend/Chatify/Utils/tokenCookieGenerator.mjs, Frontend/Chatify/src/api/apiOrigin.ts |

## Attack Surface, Mitigations, and Attacker Stories

### Inventory coverage gate

| Surface | Mapped | Total | Unmapped | Ambiguous |
| --- | --- | --- | --- | --- |
| httpRoutes | 116 | 116 | 0 | 0 |
| socketEvents | 67 | 67 | 0 | 0 |
| serviceWorkerEvents | 2 | 2 | 0 | 0 |
| backgroundJobs | 18 | 18 | 0 | 0 |
| dataModels | 22 | 22 | 0 | 0 |
| externalProviders | 9 | 9 | 0 | 0 |

### Attacker stories

| ID | Story | Actor | Severity | Attack | Security outcome | Existing mitigations |
| --- | --- | --- | --- | --- | --- | --- |
| STORY-ACCOUNT-TAKEOVER | Forge or replay an authentication/session credential | unauthenticated-internet-user | critical | Exploit token verification, session binding, refresh rotation, or revocation to impersonate another user. | Account takeover and access to private conversations and connected sockets. | Signed JWTs; hashed refresh tokens; active session records; rotation and revocation tests |
| STORY-OAUTH-CONFUSION | Link an attacker-controlled OAuth identity to a victim account | unauthenticated-internet-user | critical | Abuse email matching, callback state, or handoff finalization to merge or log in as the victim. | Persistent account takeover. | Provider identifier binding; OAuth handoff records; explicit finalization; account-linking tests |
| STORY-RESET-MFA-BYPASS | Bypass password-reset or MFA challenge controls | unauthenticated-internet-user | critical | Enumerate accounts, brute-force or replay a reset/MFA token, or reuse a backup code. | Account takeover or MFA downgrade. | Non-enumerating responses; rate limits; hashing; expiry; one-time backup-code use |
| STORY-HTTP-IDOR | Read or mutate another conversation through an object identifier | authenticated-user | high | Call message, attachment, chat, invite, space, saved-message, or moderation endpoints with a foreign identifier. | Cross-user confidentiality or integrity violation. | Resource-level membership/ownership helpers; protected routes; authorization tests |
| STORY-SOCKET-ROOM | Join or receive events from an unauthorized Socket.IO room | authenticated-user | high | Supply a foreign chat ID, reuse a revoked session, or exploit origin handling to receive room or user events. | Private message, presence, call, or social-graph disclosure. | Origin allowlist; session validation; membership checks; room/user-targeted emission |
| STORY-SOCKET-DOS | Exhaust Socket.IO resources with event or signaling floods | authenticated-user | high | Flood chat, typing, delivery, call, SDP, or ICE events or create timers/state faster than cleanup. | Memory, CPU, database, or peer-notification exhaustion. | Per-event windows; payload length limits; session state machine; cleanup on disconnect |
| STORY-UPLOAD-ACTIVE-CONTENT | Store or serve malicious attachment or profile content | authenticated-user | high | Use MIME confusion, polyglots, oversized files, executable SVG/HTML, or foreign storage IDs. | Stored XSS, malware delivery, storage abuse, or cross-chat file access. | Size/count limits; magic-byte validation; protected delivery routes; server-owned metadata |
| STORY-E2EE-PLAINTEXT | Cause encrypted-chat plaintext or key material to reach the server or notifications | conversation-peer | critical | Exploit a fallback, serializer, search, reply, moderation, logging, or notification path that handles plaintext. | Systemic breach of the encrypted-conversation promise. | Encrypted envelope model; encrypted-message utilities; metadata-only notifications and activity records; E2EE tests |
| STORY-ROLE-ESCALATION | Escalate to group manager, moderator, or administrator | authenticated-user | critical | Mass-assign role/status fields, exploit stale membership, or bypass requireAdmin and manager checks. | Unauthorized moderation, diagnostics, privacy operations, membership changes, or broad data access. | Server-side role state; private role selection; admin middleware; role-specific tests |
| STORY-INTEGRATION-TOKEN | Steal, replay, or over-scope an integration token | integration-client | critical | Recover a plaintext token from storage/logs, replay a revoked token, or call an operation outside installation scope. | Persistent third-party access or cross-installation compromise. | Token hashing; rotation/revocation; scope checks; runtime rate limit; audit log |
| STORY-CSRF-CROSS-ORIGIN | Drive state changes from a malicious origin | malicious-web-origin | high | Submit credentialed mutation requests or initiate a cross-site socket using ambient cookies. | Unwanted account, conversation, membership, or session actions. | Signed double-submit CSRF; credentialed CORS allowlist; Socket.IO origin allowlist; SameSite/Secure cookie settings |
| STORY-OUTBOUND-SSRF | Redirect an outbound request to an attacker-selected destination | authenticated-user | high | Inject a loopback, link-local, metadata-service, redirect, proxy, webhook, image, or ICE destination. | SSRF, internal service access, credential leakage, or resource exhaustion. | Fixed/operator-controlled destinations; provider-specific configuration; timeout/redirect/size controls; later source-to-sink validation |
| STORY-NOTIFICATION-LEAK | Expose private content through email, push, or browser notifications | delivery-provider | high | Include message text, sender email, encrypted plaintext, or a reusable endpoint/token in a provider or lock-screen payload. | Conversation disclosure outside authorized Chatify UI. | No-preview policy; generic templates; endpoint hashing; preference controls |
| STORY-PRIVACY-OPERATION | Export or delete another user or incompletely delete the requester | authenticated-user | high | Swap a user identifier, replay a job, race cancellation, or omit related records from export/deletion. | Cross-user data disclosure, unauthorized deletion, or regulatory/contractual failure. | Requester binding; pending grace state; idempotent operation runs; metadata-only evidence; privacy tests |
| STORY-LOG-SECRET-LEAK | Leak tokens, cookies, PII, or message content through logs and evidence | operator-ci-developer | high | Trigger logging of Authorization headers, cookies, provider responses, raw endpoints, encrypted/plain message content, or environment values. | Secondary credential or privacy breach through operational systems. | Structured redaction; sanitized provider errors; inventory redaction; ops secret patterns |
| STORY-PRESENCE-ENUMERATION | Enumerate users, presence, membership, or relationship state | authenticated-user | medium | Probe usernames, contact requests, chat membership, last-seen, typing, or online state for unrelated users. | Targeting, stalking, and social-graph disclosure. | Username normalization and bounded search; relationship/membership checks; privacy settings; targeted socket events |
| STORY-WORKER-REPLAY | Replay or race notification and privacy jobs | authenticated-user | medium | Create duplicate outbox entries, race claims, or repeatedly process a deletion/export operation. | Duplicate notifications, inconsistent privacy state, or service degradation. | Dedupe keys; terminal status; claim logic; operation-run evidence |

### Out-of-scope attacker stories

- Reading data from a victim device that is already unlocked, rooted, malware-infected, or controlled by a malicious browser extension.
- Breaking TLS, WebRTC transport encryption, Argon2, AES-256-GCM, JWT signatures, MongoDB authentication, or OAuth provider cryptography without an integration or configuration flaw in Chatify.
- A trusted administrator intentionally abusing legitimate production database, secret-store, hosting, or provider-console access; missing least privilege, auditability, or guardrails for that access remain relevant infrastructure findings.
- Provider-wide outages or malicious behavior by Google, GitHub, Discord, Brevo/email, push services, MongoDB, STUN/TURN, Vercel, Render, GitHub, DNS, or certificate authorities, except where Chatify fails to validate, minimize, isolate, or degrade safely.
- Phishing, password reuse, social engineering, and attacks on user email accounts that do not exploit Chatify; Chatify recovery and session invalidation behavior after such events remains in scope.

## Severity Calibration (Critical, High, Medium, Low)

### Critical

- Authentication or active-session bypass that permits reliable takeover of another account or broad impersonation.
- Normal-user escalation to administrator, unrestricted moderation/privacy operations, or cross-tenant-style access to many conversations.
- OAuth account-linking confusion, reset/MFA bypass, integration-token forgery, or exposed signing/encryption secrets enabling persistent privileged access.
- Systemic disclosure of plaintext or key material from conversations represented as end-to-end encrypted.

### High

- IDOR or Socket.IO room authorization failure exposing or modifying another user or conversation.
- Stored active-content upload, CSRF with meaningful state change, bearer-token leakage, or attacker-controlled backend destination with internal-network impact.
- Notification, moderation, privacy export, attachment, or operational-log path disclosing private content or reusable secrets.
- Remotely triggerable resource exhaustion that materially degrades messaging, calling, authentication, storage, or workers.

### Medium

- Bounded presence, last-seen, membership, username, queue, or relationship enumeration without direct message-content access.
- Limited worker replay, audit gap, or error-detail leak that requires an authenticated attacker and exposes only constrained metadata.
- Defense-in-depth weakness whose exploitation requires a separate privileged compromise or unsafe external configuration.

### Low

- Non-sensitive version, health, or generic operational detail that does not materially aid an attack.
- Minor rate-limit, logging, or hardening inconsistency with no demonstrated confidentiality, integrity, availability, authentication, or authorization impact.
- Test-only, documentation-only, or heuristic scanner evidence that is not reachable in a deployed or privileged workflow.

Repository: MohammedGhazal09/Chatify
Version: 46dff3834a9f727840cfb02a2e8acaef43cf06f8
