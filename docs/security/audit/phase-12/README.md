# Chatify Security Audit — Phase 12 Integrations, Email, and Web Push

## Audited scope

- Repository: `MohammedGhazal09/Chatify`
- Implementation branch: `security/phase-12-integrations-notifications`
- Stacked base: `security/phase-11-upload-attachments`
- Existing integration surfaces: application registration, target-scoped installation, runtime-token rotation/revocation, and a read-only runtime manifest
- Existing notification surfaces: Brevo transactional email and stored Web Push subscriptions delivered through the notification outbox

The audited branch does not contain an inbound webhook endpoint or a user-configurable outbound webhook destination. The `webhooks:send` integration scope is metadata only in the current runtime contract. Webhook signature, replay, redirect, and destination controls are therefore not represented as implemented product behavior in this phase.

## Implemented controls

### Integration authorization and secret handling

- Integration applications have an explicit allowlist of supported scopes.
- Installation scopes must be a subset of the application's allowed scopes.
- Space and chat installations require target-level authorization before creation.
- Runtime tokens are generated once, stored only as hashes, and never returned by diagnostics or audit records after issuance.
- Runtime-token rotation immediately invalidates the previous token.
- Revoked installations fail closed at runtime.
- Integration audit records use action and object identifiers without copying runtime tokens or user email addresses.
- Administrator diagnostics return aggregate application, installation, scope, and runtime state without secret material.

### Outbound destination validation

- Dynamic push endpoints must be canonical HTTPS URLs.
- URL credentials, fragments, nonstandard ports, control characters, local hostnames, single-label hostnames, and private infrastructure suffixes are rejected.
- Literal IPv4 and IPv6 destinations are classified before storage; loopback, unspecified, private, link-local, carrier-grade NAT, benchmark, documentation, multicast, reserved, IPv4-mapped, NAT64, Teredo, ORCHID, and 6to4 destinations are rejected.
- DNS is resolved through a restricted lookup used directly by the HTTPS agent.
- Every returned address must be globally routable. A mixed public/private answer fails closed rather than selecting the public member.
- The validated DNS answer is returned to the connection attempt, preventing a second unrestricted lookup between validation and connection.
- Stored legacy subscriptions are revalidated immediately before delivery. Unsafe entries are removed and the associated outbox job is terminally failed without contacting the provider.

### Web Push lifecycle and availability controls

- Push requests use the restricted HTTPS agent.
- Delivery has a 10-second network timeout and a 60-second provider TTL.
- Push payloads remain generic and route only to the local `/chat` path.
- Provider responses `404` and `410` are treated as expired subscriptions: the subscription is removed, push is disabled when no subscriptions remain, and the job is not retried.
- Missing or unsafe subscriptions are terminal failures rather than repeated provider work.
- Other transient provider errors continue to use the bounded outbox retry schedule.
- Provider errors are sanitized before persistence or logging.

### Email security

- Transactional email is sent only to the fixed Brevo HTTPS API endpoint.
- API credentials and sender identity are required; there is no production fallback sender.
- Sender and recipient email addresses are syntactically validated and reject control characters.
- Subjects reject CR, LF, and NUL characters and are bounded to 160 characters.
- HTML content is bounded to 128 KiB and text content to 32 KiB.
- The HTTP client uses a 10-second timeout, disables redirects, caps request and response bodies at 256 KiB, and requests a JSON response.
- Notification templates remain privacy-safe and do not place private message content or recipient addresses in outbox payloads.

## Verification

The permanent workflow `.github/workflows/security-phase-12-integrations-notifications.yml` uses pinned GitHub Actions, Node.js `24.19.0`, npm `11.17.0`, controlled dependency installation, source syntax checks, focused backend regressions, a production dependency audit at the high-severity threshold, and patch-hygiene validation.

The focused regression matrix covers:

- Public and non-public IPv4/IPv6 classification.
- URL scheme, authority, port, fragment, local-host, and literal-address rejection.
- DNS rebinding through mixed public/private answers.
- DNS family mismatch and empty-answer failure behavior.
- Push-subscription registration and deletion without endpoint disclosure.
- Restricted-agent, timeout, and TTL delivery options.
- Expired and legacy-unsafe subscription cleanup.
- Email redirect, timeout, size, configuration, and header-injection controls.
- Existing notification outbox privacy, idempotency, mute, block, and delivery behavior.
- Existing integration scope, target authorization, token rotation/revocation, and audit behavior.

## Phase boundary and residual risks

- Webhook authenticity and replay controls remain not applicable until Chatify introduces an inbound webhook endpoint. A future implementation must define a signed raw-body contract, bounded timestamp skew, persistent replay identifiers, secret rotation, and failure-safe parsing before enabling the route.
- A future configurable outbound integration destination must reuse the restricted destination policy and additionally define redirect behavior, allowed methods, response-size limits, credential isolation, and per-installation economic limits.
- Rejecting nonstandard HTTPS ports and mixed DNS answers is intentionally conservative. Push-provider compatibility should be monitored before broadening either policy.
- DNS policy and application timeouts do not replace deployment-layer egress filtering, resolver policy, proxy limits, provider quotas, or infrastructure monitoring; those remain assigned to the availability and infrastructure phases.
- Provider account configuration, domain authentication, bounce/complaint processing, and credential rotation require operational evidence outside the repository.
- This phase does not claim Socket.IO post-connection revocation, presence privacy, WebRTC signaling, browser rendering, service-worker cache isolation, or later-phase infrastructure controls.
