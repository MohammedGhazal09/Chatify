export const REPOSITORY_ID = 'MohammedGhazal09/Chatify'

export const actors = [
  {
    id: 'actor-unauthenticated-client',
    name: 'Unauthenticated web client',
    control: 'attacker-controlled',
    description: 'Any browser or HTTP client that has not established a valid Chatify session.',
  },
  {
    id: 'actor-authenticated-user',
    name: 'Authenticated Chatify user',
    control: 'partially-attacker-controlled',
    description: 'A legitimate account holder whose browser, account, or session may still act maliciously.',
  },
  {
    id: 'actor-malicious-user',
    name: 'Malicious, blocked, or non-member user',
    control: 'attacker-controlled',
    description: 'An authenticated principal attempting to cross conversation, space, or ownership boundaries.',
  },
  {
    id: 'actor-administrator',
    name: 'Chatify administrator',
    control: 'privileged-operator-controlled',
    description: 'A privileged user allowed to access moderation, privacy-operation, and integration diagnostics surfaces.',
  },
  {
    id: 'actor-integration-client',
    name: 'Installed integration client',
    control: 'third-party-controlled',
    description: 'A machine client presenting a scoped installation bearer token to the integration runtime API.',
  },
  {
    id: 'actor-oauth-provider',
    name: 'OAuth identity provider',
    control: 'third-party-controlled',
    description: 'Google, GitHub, or Discord identity infrastructure participating in login and account-linking callbacks.',
  },
  {
    id: 'actor-notification-provider',
    name: 'Email and web-push provider',
    control: 'third-party-controlled',
    description: 'External delivery infrastructure that receives privacy-minimized notification jobs and subscription material.',
  },
  {
    id: 'actor-media-network-provider',
    name: 'Media, STUN, and TURN provider',
    control: 'third-party-controlled',
    description: 'External storage or network-relay infrastructure used for protected media and call connectivity.',
  },
  {
    id: 'actor-database',
    name: 'MongoDB service and database operator',
    control: 'operator-controlled',
    description: 'Persistent storage boundary containing account, conversation, moderation, integration, and operational records.',
  },
  {
    id: 'actor-operator',
    name: 'Deployment and secret operator',
    control: 'operator-controlled',
    description: 'Maintains production environment variables, domains, provider configuration, backups, and incident response.',
  },
  {
    id: 'actor-repository-ci',
    name: 'Repository contributor and CI runner',
    control: 'developer-controlled',
    description: 'Changes source, dependencies, workflows, generated evidence, and release artifacts before deployment.',
  },
]

export const dataClasses = [
  { id: 'data-public', name: 'Public data', handling: 'May be disclosed intentionally but must retain integrity.' },
  { id: 'data-internal', name: 'Internal operational metadata', handling: 'Expose only where needed; do not leak topology or sensitive diagnostics.' },
  { id: 'data-personal', name: 'Personal and profile data', handling: 'Requester- and relationship-scoped; subject to export and deletion controls.' },
  { id: 'data-auth-secret', name: 'Authentication and recovery secrets', handling: 'Never serialize, log, or expose to untrusted clients.' },
  { id: 'data-integration-secret', name: 'Integration and provider secrets', handling: 'Store hashed or encrypted where possible and reveal only at issuance.' },
  { id: 'data-message-content', name: 'Message and conversation content', handling: 'Visible only to authorized conversation or channel members.' },
  { id: 'data-encrypted-envelope', name: 'Encrypted-message envelopes', handling: 'Server stores ciphertext and metadata without introducing plaintext recovery paths.' },
  { id: 'data-media', name: 'Attachments and profile media', handling: 'Private storage; preview and download require authorization and bounded content validation.' },
  { id: 'data-moderation', name: 'Moderation and safety records', handling: 'Minimize context, restrict access, and preserve an auditable review trail.' },
  { id: 'data-presence-call', name: 'Presence and call signaling', handling: 'Ephemeral and participant-scoped; payloads must be bounded and rate limited.' },
  { id: 'data-notification', name: 'Notification subscriptions and jobs', handling: 'Keep message previews private and provider payloads minimal.' },
  { id: 'data-telemetry', name: 'Logs and operational telemetry', handling: 'Structured, redacted, retention-controlled, and free of secrets or private content.' },
  { id: 'data-privacy-operations', name: 'Export and deletion state', handling: 'Requester- or administrator-authorized with metadata-only evidence.' },
]

export const assets = [
  { id: 'asset-sessions', name: 'Sessions, access tokens, and refresh tokens', dataClassIds: ['data-auth-secret'] },
  { id: 'asset-csrf', name: 'CSRF token integrity', dataClassIds: ['data-auth-secret'] },
  { id: 'asset-accounts', name: 'Accounts, usernames, profiles, and privacy preferences', dataClassIds: ['data-personal'] },
  { id: 'asset-membership', name: 'Conversation, group, and space membership', dataClassIds: ['data-personal', 'data-internal'] },
  { id: 'asset-messages', name: 'Message history, reactions, read state, and search results', dataClassIds: ['data-message-content'] },
  { id: 'asset-encrypted-messages', name: 'End-to-end encrypted message envelopes', dataClassIds: ['data-encrypted-envelope'] },
  { id: 'asset-media', name: 'Attachments, voice messages, and profile images', dataClassIds: ['data-media'] },
  { id: 'asset-admin', name: 'Administrative and moderation privilege', dataClassIds: ['data-moderation', 'data-internal'] },
  { id: 'asset-moderation', name: 'Reports, enforcement, appeals, and review history', dataClassIds: ['data-moderation'] },
  { id: 'asset-integrations', name: 'Integration applications, installations, scopes, and tokens', dataClassIds: ['data-integration-secret', 'data-internal'] },
  { id: 'asset-oauth', name: 'OAuth identities and provider credentials', dataClassIds: ['data-auth-secret', 'data-personal'] },
  { id: 'asset-notifications', name: 'Notification preferences, subscriptions, and delivery jobs', dataClassIds: ['data-notification', 'data-personal'] },
  { id: 'asset-presence-calls', name: 'Presence state, call sessions, and WebRTC signaling', dataClassIds: ['data-presence-call'] },
  { id: 'asset-database', name: 'Database integrity, indexes, and persistence availability', dataClassIds: ['data-internal'] },
  { id: 'asset-telemetry', name: 'Health, readiness, audit logs, and operational evidence', dataClassIds: ['data-telemetry', 'data-internal'] },
  { id: 'asset-privacy-operations', name: 'User export, deletion, and anonymization workflows', dataClassIds: ['data-privacy-operations', 'data-personal'] },
  { id: 'asset-build-release', name: 'Source, dependencies, workflows, and release provenance', dataClassIds: ['data-internal'] },
]

export const trustBoundaries = [
  {
    id: 'boundary-browser-http',
    name: 'Browser or API client to Express HTTP API',
    fromActorIds: ['actor-unauthenticated-client', 'actor-authenticated-user', 'actor-malicious-user'],
    toActorIds: ['actor-operator'],
    controls: ['CORS with credentials', 'Helmet', 'body-size limits', 'rate limiting', 'sanitization', 'route middleware'],
  },
  {
    id: 'boundary-browser-socket',
    name: 'Browser to Socket.IO realtime server',
    fromActorIds: ['actor-authenticated-user', 'actor-malicious-user'],
    toActorIds: ['actor-operator'],
    controls: ['origin allowlist', 'cookie token verification', 'active-session validation', 'room membership checks', 'per-event rate limits'],
  },
  {
    id: 'boundary-auth-session',
    name: 'Anonymous or stale client to authenticated active session',
    fromActorIds: ['actor-unauthenticated-client', 'actor-authenticated-user'],
    toActorIds: ['actor-authenticated-user'],
    controls: ['JWT verification', 'active session claims', 'refresh rotation', '2FA and recovery validation'],
  },
  {
    id: 'boundary-resource-membership',
    name: 'Authenticated identity to owned or member-scoped resources',
    fromActorIds: ['actor-authenticated-user', 'actor-malicious-user'],
    toActorIds: ['actor-database'],
    controls: ['chat membership assertions', 'ownership checks', 'block controls', 'space role checks'],
  },
  {
    id: 'boundary-user-admin',
    name: 'Standard user to administrative privilege',
    fromActorIds: ['actor-authenticated-user', 'actor-malicious-user'],
    toActorIds: ['actor-administrator'],
    controls: ['server-side role lookup', 'administrator middleware', 'moderation audit records'],
  },
  {
    id: 'boundary-integration-runtime',
    name: 'Third-party integration to scoped runtime API',
    fromActorIds: ['actor-integration-client'],
    toActorIds: ['actor-operator'],
    controls: ['bearer token parsing', 'hashed token lookup', 'scope checks', 'revocation and rotation'],
  },
  {
    id: 'boundary-application-database',
    name: 'Application services to MongoDB',
    fromActorIds: ['actor-operator'],
    toActorIds: ['actor-database'],
    controls: ['Mongoose schemas', 'indexes', 'sanitization', 'membership filters', 'bounded queries'],
  },
  {
    id: 'boundary-application-provider',
    name: 'Application to OAuth, email, and web-push providers',
    fromActorIds: ['actor-operator'],
    toActorIds: ['actor-oauth-provider', 'actor-notification-provider'],
    controls: ['environment-sourced credentials', 'provider-specific validation', 'privacy-minimized payloads', 'timeouts and error sanitization'],
  },
  {
    id: 'boundary-application-media-network',
    name: 'Application and browser to storage, STUN, and TURN infrastructure',
    fromActorIds: ['actor-authenticated-user', 'actor-operator'],
    toActorIds: ['actor-media-network-provider'],
    controls: ['protected media routes', 'content-type and size validation', 'bounded ICE configuration', 'participant authorization'],
  },
  {
    id: 'boundary-repository-deployment',
    name: 'Repository and CI to deployed runtime and secrets',
    fromActorIds: ['actor-repository-ci'],
    toActorIds: ['actor-operator'],
    controls: ['reviewed pull requests', 'lockfiles', 'CI quality gates', 'generated security evidence', 'environment separation'],
  },
]

export const securityInvariants = [
  { id: 'invariant-01-principal-server-derived', title: 'Server-derived principal', statement: 'Authenticated identity must be derived from a verified token or integration installation, never from a client-supplied user identifier.' },
  { id: 'invariant-02-active-session', title: 'Active-session enforcement', statement: 'Cookie-authenticated HTTP and Socket.IO access must reject expired, revoked, missing, or cross-user session claims.' },
  { id: 'invariant-03-csrf', title: 'CSRF protection', statement: 'Every unsafe cookie-authenticated HTTP mutation must require a valid signed double-submit CSRF token unless it uses a separate non-cookie trust boundary.' },
  { id: 'invariant-04-origin', title: 'Origin alignment', statement: 'HTTP CORS, Socket.IO origins, cookie attributes, and deployed frontend origins must remain mutually consistent and fail closed in production.' },
  { id: 'invariant-05-resource-ownership', title: 'Resource ownership', statement: 'Endpoints accepting resource identifiers must enforce requester ownership, membership, or an explicit public contract before reading or mutating data.' },
  { id: 'invariant-06-conversation-membership', title: 'Conversation membership', statement: 'Message, attachment, search, unread, reaction, pin, and realtime operations must be limited to current authorized conversation or channel members.' },
  { id: 'invariant-07-conversation-controls', title: 'Conversation safety controls', statement: 'Blocking, moderation restrictions, deletion state, and membership changes must immediately prevent prohibited conversation activity.' },
  { id: 'invariant-08-admin', title: 'Administrator authorization', statement: 'Administrative, moderation-review, privacy-operation, and diagnostic surfaces must verify current server-side administrator privilege.' },
  { id: 'invariant-09-integration-scope', title: 'Scoped integrations', statement: 'Integration tokens must be unguessable, stored non-reversibly where feasible, scoped, rotatable, revocable, and checked on every runtime action.' },
  { id: 'invariant-10-socket-auth', title: 'Socket authentication and origin', statement: 'Socket.IO handshakes must validate an allowed origin, a verified cookie token, and an active session before any application event is registered.' },
  { id: 'invariant-11-socket-room', title: 'Socket room authorization', statement: 'Joining rooms, receiving broadcasts, and emitting member events must require current membership and must not trust arbitrary room identifiers.' },
  { id: 'invariant-12-socket-bounds', title: 'Socket payload and rate bounds', statement: 'Attacker-controlled realtime payloads must be structurally validated, size bounded, and rate limited before persistence or forwarding.' },
  { id: 'invariant-13-call-participants', title: 'Call participant authorization', statement: 'Call start, acceptance, termination, SDP, and ICE signaling must be limited to authorized participants in an active call session.' },
  { id: 'invariant-14-message-state', title: 'Authoritative message state', statement: 'Message creation and state transitions must be server-authoritative, idempotent where retried, and monotonic where delivery or read state advances.' },
  { id: 'invariant-15-secret-serialization', title: 'Secret non-disclosure', statement: 'Passwords, reset material, 2FA secrets, backup-code hashes, session tokens, provider credentials, and private keys must never be serialized or logged.' },
  { id: 'invariant-16-oauth-linking', title: 'OAuth account binding', statement: 'OAuth callbacks must validate provider configuration and bind identities without silently linking an attacker-controlled provider identity to another account.' },
  { id: 'invariant-17-secret-source', title: 'Secret source separation', statement: 'Production credentials and cryptographic secrets must come from controlled runtime configuration and must not be committed in source, examples, artifacts, or logs.' },
  { id: 'invariant-18-outbound-destination', title: 'Outbound destination control', statement: 'Server-side outbound requests must use intended providers or validated destinations with time, redirect, response-size, and retry bounds appropriate to the call.' },
  { id: 'invariant-19-database-input', title: 'Database input safety', statement: 'Attacker-controlled query and update material must not introduce operator injection, prototype pollution, unbounded scans, or unsafe mass assignment.' },
  { id: 'invariant-20-media', title: 'Private bounded media', statement: 'Uploaded and downloaded media must enforce requester authorization, type and size validation, private storage references, and safe response headers.' },
  { id: 'invariant-21-encrypted-content', title: 'Encrypted-content separation', statement: 'Encrypted conversations must not persist or expose plaintext through history, search, notifications, moderation context, logs, or fallback fields.' },
  { id: 'invariant-22-notification-privacy', title: 'Notification privacy', statement: 'Email, push, service-worker, and outbox payloads must avoid private message previews and disclose only the minimum routing metadata required.' },
  { id: 'invariant-23-log-redaction', title: 'Log and diagnostic redaction', statement: 'Operational logs and diagnostics must exclude tokens, cookies, message bodies, provider payloads, private profile data, and raw sensitive errors.' },
  { id: 'invariant-24-privacy-operations', title: 'Privacy-operation authorization', statement: 'Exports, deletion requests, cancellation, anonymization, and administrative privacy status must be requester- or administrator-authorized and auditable.' },
  { id: 'invariant-25-moderation-minimization', title: 'Moderation minimization', statement: 'Reports and appeals must include only authorized, redacted context and preserve assignment, decision, appeal, and enforcement history.' },
  { id: 'invariant-26-build-provenance', title: 'Build and dependency provenance', statement: 'Production artifacts must derive from reviewed source and lockfiles, with dependency advisories, tests, lint, builds, and security evidence visible rather than suppressed.' },
  { id: 'invariant-27-distributed-state', title: 'Distributed-state assumption', statement: 'Single-process presence, rate-window, queue, and call-timer state must not be treated as globally authoritative after horizontal scaling without shared coordination.' },
]

export const assumptions = [
  'TLS terminates at a trusted deployment edge and production proxy configuration preserves the effective HTTPS host and origin.',
  'MongoDB, provider accounts, deployment variables, and backup access are administered by trusted operators outside the public application boundary.',
  'The frontend may be fully attacker-controlled; browser-side checks and TypeScript types are usability controls, not authorization boundaries.',
  'Any authenticated user, installed integration, uploaded file, OAuth callback parameter, Socket.IO payload, route parameter, query, and request body may be malicious.',
  'The current Socket.IO presence and call-timer maps are process-local; safe horizontal scaling requires a shared adapter and shared coordination state.',
  'End-to-end encryption protects selected message content only to the extent implemented by the client protocol; server-visible metadata remains sensitive.',
]

export const outOfScope = [
  'Compromise of the GitHub, cloud, database, OAuth-provider, email-provider, push-provider, or TURN-provider control planes themselves.',
  'Malicious operating-system, browser-extension, or endpoint compromise after a user has legitimately decrypted or displayed data.',
  'Cryptographic breaks in standard algorithms when the application uses them correctly and keys remain secret.',
  'Denial of service requiring control of infrastructure capacity far beyond the application-level rate and payload boundaries modeled here.',
]

export const attackerStories = [
  { id: 'story-01-session-theft', actorIds: ['actor-unauthenticated-client'], targetAssetIds: ['asset-sessions', 'asset-accounts'], story: 'An attacker replays a stolen or revoked cookie to impersonate a user.', entryPoints: ['HTTP cookies', 'Socket.IO handshake'], preventedBy: ['invariant-01-principal-server-derived', 'invariant-02-active-session', 'invariant-10-socket-auth'] },
  { id: 'story-02-csrf', actorIds: ['actor-unauthenticated-client'], targetAssetIds: ['asset-accounts', 'asset-messages'], story: 'A hostile origin causes a logged-in browser to perform an unsafe state-changing request.', entryPoints: ['cookie-authenticated HTTP mutations'], preventedBy: ['invariant-03-csrf', 'invariant-04-origin'] },
  { id: 'story-03-idor', actorIds: ['actor-malicious-user'], targetAssetIds: ['asset-membership', 'asset-messages', 'asset-media'], story: 'A user substitutes another conversation, message, attachment, session, invite, or profile identifier.', entryPoints: ['route parameters', 'query parameters', 'request bodies'], preventedBy: ['invariant-05-resource-ownership', 'invariant-06-conversation-membership'] },
  { id: 'story-04-admin-escalation', actorIds: ['actor-malicious-user'], targetAssetIds: ['asset-admin', 'asset-moderation'], story: 'A standard user invokes administrative diagnostics or moderation decisions.', entryPoints: ['/api/admin', 'moderation review actions'], preventedBy: ['invariant-08-admin', 'invariant-25-moderation-minimization'] },
  { id: 'story-05-socket-room', actorIds: ['actor-malicious-user'], targetAssetIds: ['asset-messages', 'asset-presence-calls'], story: 'A socket joins an arbitrary room or sends state changes for a conversation it cannot access.', entryPoints: ['chat:join', 'typing', 'delivery', 'call events'], preventedBy: ['invariant-10-socket-auth', 'invariant-11-socket-room', 'invariant-12-socket-bounds'] },
  { id: 'story-06-call-forwarding', actorIds: ['actor-malicious-user'], targetAssetIds: ['asset-presence-calls'], story: 'A user forwards oversized or unauthorized SDP or ICE material to an unrelated peer.', entryPoints: ['call:offer', 'call:answer', 'call:ice-candidate'], preventedBy: ['invariant-12-socket-bounds', 'invariant-13-call-participants'] },
  { id: 'story-07-message-race', actorIds: ['actor-authenticated-user'], targetAssetIds: ['asset-messages'], story: 'Retries or concurrent events create duplicates or regress delivery/read state.', entryPoints: ['HTTP message creation', 'Socket.IO delivery receipts'], preventedBy: ['invariant-14-message-state'] },
  { id: 'story-08-secret-leak', actorIds: ['actor-repository-ci', 'actor-authenticated-user'], targetAssetIds: ['asset-sessions', 'asset-oauth', 'asset-integrations'], story: 'A secret reaches JSON output, a log, a generated artifact, or committed configuration.', entryPoints: ['serialization', 'logging', 'CI artifacts', 'environment examples'], preventedBy: ['invariant-15-secret-serialization', 'invariant-17-secret-source', 'invariant-23-log-redaction'] },
  { id: 'story-09-oauth-confusion', actorIds: ['actor-unauthenticated-client', 'actor-oauth-provider'], targetAssetIds: ['asset-oauth', 'asset-accounts'], story: 'An OAuth callback is replayed, misbound, or linked to the wrong local account.', entryPoints: ['OAuth start and callback routes'], preventedBy: ['invariant-16-oauth-linking', 'invariant-04-origin'] },
  { id: 'story-10-integration-token', actorIds: ['actor-integration-client'], targetAssetIds: ['asset-integrations', 'asset-messages'], story: 'A leaked, revoked, or under-scoped integration token is used beyond its installation permissions.', entryPoints: ['/api/integrations/runtime'], preventedBy: ['invariant-09-integration-scope'] },
  { id: 'story-11-ssrf', actorIds: ['actor-malicious-user', 'actor-integration-client'], targetAssetIds: ['asset-integrations', 'asset-build-release'], story: 'Attacker-influenced destination data causes the backend to contact an internal or unintended endpoint.', entryPoints: ['generic HTTP integrations', 'provider configuration'], preventedBy: ['invariant-18-outbound-destination', 'invariant-19-database-input'] },
  { id: 'story-12-injection', actorIds: ['actor-malicious-user'], targetAssetIds: ['asset-database', 'asset-accounts', 'asset-messages'], story: 'Structured input introduces database operators, polluted prototypes, or unsafe mass assignment.', entryPoints: ['body', 'query', 'route parameters', 'integration manifests'], preventedBy: ['invariant-19-database-input', 'invariant-05-resource-ownership'] },
  { id: 'story-13-malicious-upload', actorIds: ['actor-malicious-user'], targetAssetIds: ['asset-media', 'asset-accounts'], story: 'A disguised, oversized, or unauthorized file is stored or served as active content.', entryPoints: ['message attachments', 'voice messages', 'profile images'], preventedBy: ['invariant-20-media', 'invariant-06-conversation-membership'] },
  { id: 'story-14-encrypted-plaintext', actorIds: ['actor-authenticated-user', 'actor-repository-ci'], targetAssetIds: ['asset-encrypted-messages'], story: 'A fallback, search index, notification, report, or log introduces plaintext for an encrypted conversation.', entryPoints: ['message persistence', 'search', 'notifications', 'moderation', 'telemetry'], preventedBy: ['invariant-21-encrypted-content', 'invariant-22-notification-privacy', 'invariant-23-log-redaction'] },
  { id: 'story-15-notification-leak', actorIds: ['actor-notification-provider', 'actor-unauthenticated-client'], targetAssetIds: ['asset-notifications', 'asset-messages'], story: 'A push or email payload exposes private message previews or reusable subscription material.', entryPoints: ['notification outbox', 'email provider', 'web push', 'service worker'], preventedBy: ['invariant-22-notification-privacy', 'invariant-15-secret-serialization'] },
  { id: 'story-16-privacy-abuse', actorIds: ['actor-malicious-user', 'actor-administrator'], targetAssetIds: ['asset-privacy-operations', 'asset-accounts'], story: 'A user exports or deletes another account, or an operator performs an unaudited privacy action.', entryPoints: ['privacy export', 'deletion request', 'administrative privacy operations'], preventedBy: ['invariant-24-privacy-operations', 'invariant-08-admin'] },
  { id: 'story-17-scale-split-brain', actorIds: ['actor-operator'], targetAssetIds: ['asset-presence-calls', 'asset-telemetry'], story: 'Horizontal replicas disagree about online users, rate windows, queues, or call cleanup and make unsafe decisions.', entryPoints: ['deployment scaling', 'Socket.IO adapter', 'process-local timers'], preventedBy: ['invariant-27-distributed-state', 'invariant-26-build-provenance'] },
]

export const severityCalibration = {
  critical: {
    definition: 'A practical path to broad compromise of production trust, mass private-data exposure, arbitrary server execution, or durable administrative takeover.',
    examples: [
      'Unauthenticated remote code execution in the deployed backend or build path.',
      'A universal authentication bypass or signing-key disclosure enabling takeover of arbitrary accounts.',
      'Cross-tenant extraction of a substantial portion of message, media, or authentication data.',
    ],
  },
  high: {
    definition: 'A reliable cross-account or privileged-boundary violation with significant confidentiality, integrity, or availability impact.',
    examples: [
      'Reading or mutating another conversation, attachment, session, moderation record, or privacy export through an IDOR.',
      'Administrator or integration-scope escalation, exploitable SSRF to sensitive internal services, or reusable credential disclosure.',
      'Unauthorized forwarding of call signaling or stored message content to unrelated users.',
    ],
  },
  medium: {
    definition: 'A bounded security failure requiring authentication, user interaction, unusual configuration, or producing limited data or availability impact.',
    examples: [
      'A scoped denial of service through insufficient payload or query bounds.',
      'Limited metadata disclosure, low-impact CSRF, or a privacy control that affects only the requester.',
      'A race condition that causes temporary incorrect state without crossing membership or privilege boundaries.',
    ],
  },
  low: {
    definition: 'Defense-in-depth weakness, low-value information exposure, or behavior with negligible practical attacker impact in the deployed model.',
    examples: [
      'Benign version or health metadata that does not expose secrets or topology.',
      'A missing hardening header on a response that cannot contain active or private content.',
      'Developer-only tooling behavior that cannot reach production credentials, artifacts, or runtime code.',
    ],
  },
}

export const limitations = [
  'This model classifies repository surfaces and security invariants; it does not assert that each invariant is currently satisfied.',
  'Static inventory cannot prove runtime infrastructure settings, provider-account security, deployment-edge behavior, or production secret rotation.',
  'Dynamic routes, event names, destinations, and reflection-heavy behavior require targeted runtime validation in later phases.',
  'Dependency advisories and exploitability are recorded by Phase 1 and the existing foundation workflow but are remediated and retested in Phase 4.',
]
