# Chatify Security Audit Finding Register

Audit baseline: `91bceade67039b4a874a5d873e2f10ef0230b117` (main), reviewed through the pull-request merge checkout captured by the temporary audit workflow.

This register records validated repository-local findings. Findings are removed only after a regression test demonstrates the issue, the remediation is applied, and the relevant verification suite passes.

| ID | Severity | Area | Validated issue |
|---|---|---|---|
| CHAT-SEC-001 | High | Sessions | Access tokens without a `sessionId` are accepted as legacy tokens, bypassing server-side revocation. |
| CHAT-SEC-002 | High | Socket.IO | Socket authentication is checked only during handshake, so connected sockets can survive access-token expiry or session revocation. |
| CHAT-SEC-003 | Medium | Socket.IO availability | Event rate limits are keyed by socket ID and cleared on disconnect, allowing reconnect and parallel-socket bypasses. |
| CHAT-SEC-004 | High | Password reset | Reset-code attempts and final consumption are non-atomic, permitting concurrent attempt-limit and one-time-use bypasses. |
| CHAT-SEC-005 | High | Web push / SSRF | Authenticated users can persist arbitrary HTTPS push endpoints that the server later requests. |
| CHAT-SEC-006 | Medium | Service worker | Notification click payloads can navigate to arbitrary external URLs. |
| CHAT-SEC-007 | Medium | Cryptography | AES-GCM records are decoded without strict algorithm, canonical encoding, IV, tag, and ciphertext-length checks. |
| CHAT-SEC-008 | High | MFA | Login challenges and backup-code consumption use read-modify-save flows vulnerable to concurrent replay. |
| CHAT-SEC-009 | High | Account lifecycle | Local signup issues a full authenticated session before email ownership is proven, enabling email squatting and OAuth denial. |
| CHAT-SEC-010 | Medium | Notification worker | Outbox jobs are selected before being claimed atomically, enabling duplicate sends across workers. |
| CHAT-SEC-011 | Medium | Availability | The heavy-request queue releases capacity as soon as `next()` is called and has no bounded backlog. |
| CHAT-SEC-012 | Medium | Privacy worker | Due account-deletion requests are selected before an atomic worker claim, allowing duplicate processing. |
| CHAT-SEC-013 | Medium | Startup/resilience | The server begins accepting traffic before database/config readiness and lacks complete graceful shutdown orchestration. |
| CHAT-SEC-014 | High | Browser supply chain | Every page loads an unrestricted third-party tracking script from `cdnflow.co`. |
| CHAT-SEC-015 | Medium | Browser headers | The frontend deployment has no explicit CSP, framing, referrer, permissions, or HSTS policy. |
| CHAT-SEC-016 | High | Dependencies | Backend and frontend production dependency trees contain high/critical known vulnerabilities. |
| CHAT-SEC-017 | Medium | CI supply chain | GitHub Actions are referenced by mutable major-version tags instead of immutable commit SHAs. |
| CHAT-SEC-018 | Low | Password/model errors | Password schema trimming mutates credentials, and one duplicate-email hook invokes `CustomError` without `new`. |
| CHAT-SEC-019 | Low | Diagnostics | Queue diagnostics are publicly reachable without administrator authorization. |
| CHAT-SEC-020 | Low | Data races | Space-member capacity and moderation-appeal uniqueness use check-then-write flows vulnerable to concurrent requests. |
