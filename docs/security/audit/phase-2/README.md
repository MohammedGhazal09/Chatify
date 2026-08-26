# Security Audit Phase 2 — Threat Model, Trust Boundaries, and Invariants

Phase 2 converts the Phase 1 repository inventory into a reusable, repository-scoped security model. It defines what Chatify protects, who can attack it, where trust changes, which data crosses each boundary, and which invariants later audit phases must validate.

This phase is **not a vulnerability report**. Attacker stories are hypotheses and review priorities. A green Phase 2 gate means the model is internally valid and covers every current runtime surface recorded by Phase 1; it does not mean those surfaces are vulnerability-free.

## Evidence produced

| Evidence | Location | Purpose |
| --- | --- | --- |
| Authoritative model source | `threat-model.source.json` | Human-reviewed actors, zones, data classes, assets, boundaries, groups, flows, invariants, attacker stories, exclusions, and severity calibration |
| Machine-readable generated model | `threat-model.json` | Validated source plus Phase 1 runtime-surface coverage and exit gates |
| Reviewer threat model | `threat-model.md` | Repository-scoped Markdown contract for future discovery and validation phases |
| Regression tests | `scripts/security/__tests__/phase2-threat-model.test.mjs` | Reference integrity, fail-closed surface coverage, deterministic generation, CLI behavior, and drift checks |
| Runtime evidence | GitHub Actions artifact `phase-2-threat-model-evidence` | Commit, toolchain, runner, evidence hashes, command outcomes, and durations |
| Implementation plan | `docs/plans/2026-08-21-phase-2-threat-model.md` | Scope, architecture, tasks, verification, and exit criteria |

## Commands

```bash
npm run security:phase2:test
npm run security:phase2:generate
npm run security:phase2:check
npm run security:phase2:reproduce
```

`security:phase2:generate` reads the committed Phase 1 inventory and authoritative Phase 2 source, validates every reference and runtime mapping, and writes the generated JSON and Markdown files. `security:phase2:check` fails when generated evidence is absent, stale, internally inconsistent, ambiguous, or missing a current runtime surface.

## Phase mapping

### Phase 2.1 — Repository purpose, actors, and assumptions

The model identifies unauthenticated users, authenticated users, conversation peers, managers, administrators, integration clients, external providers, WebRTC peers, operators/CI/developers, and malicious web origins. It distinguishes attacker-controlled, third-party-controlled, operator-controlled, and developer-controlled inputs.

### Phase 2.2 — Assets and data classification

The model classifies public profile data, account PII, authentication secrets, session/device metadata, conversation content, encrypted-message material, social graph and presence data, media, moderation/safety records, privacy-operation records, integration credentials/audit data, notification endpoints, operational telemetry, and CI/configuration secrets.

Assets connect those classes to account identity, sessions, messaging, storage, social/spaces, moderation/privacy, integrations, notifications, and the operational control plane.

### Phase 2.3 — Trust boundaries

Ten boundaries cover public HTTP, cookie-authenticated HTTP, Socket.IO, MongoDB/GridFS, OAuth, notification providers, STUN/TURN/WebRTC, integration bearer tokens, service workers/browser storage, and CI/deployment operations. Each boundary records channels, controls already present in the repository, and assumptions that later infrastructure and deployment phases must verify.

### Phase 2.4 — Data flows and security invariants

Critical flows cover login/session rotation, OAuth, password reset/MFA, messaging, attachments, calls, notifications, integrations, moderation/privacy, and release operations. The model defines explicit invariants for identity, active sessions, CSRF, OAuth linking, reset/MFA, resource and role authorization, socket rooms and payloads, encrypted-message handling, storage, uploads, output minimization, privacy lifecycle, integration tokens, workers, outbound destinations, secrets, logs, availability, and origin alignment.

### Phase 2.5 — Attacker stories and severity calibration

Repository-specific stories cover account takeover, OAuth confusion, reset/MFA bypass, HTTP IDOR, unauthorized socket rooms, socket resource exhaustion, active-content uploads, E2EE plaintext escape, role escalation, integration-token compromise, CSRF, SSRF, notification disclosure, privacy-operation abuse, log leakage, presence enumeration, and worker replay.

Critical, high, medium, and low examples are calibrated to Chatify rather than copied from a generic severity table.

### Phase 2.6 — Drift enforcement and evidence

The coverage gate maps every Phase 1 HTTP route, Socket.IO registration, service-worker event, runtime background job, model, and external-provider group to exactly one model group. A new or ambiguous surface fails CI until the threat model is deliberately updated.

The generated model uses a digest of security-relevant runtime surfaces rather than the complete Phase 1 file inventory. This prevents audit-only file changes from creating a recursive Phase 1/Phase 2 evidence cycle while still detecting runtime attack-surface drift.

## Updating the model

When a runtime route, Socket.IO event, service-worker handler, worker, model, provider, trust boundary, data class, or security invariant changes:

```bash
npm run security:phase1:generate
npm run security:phase2:generate
npm run security:phase2:test
npm run security:phase1:check
npm run security:phase2:check
npm run doctor
```

Update `threat-model.source.json` first. Never edit the generated JSON or Markdown directly.

## Phase boundary

Phase 2 establishes the model used by later authentication, authorization, real-time protocol, dependency, data-flow, infrastructure, privacy, and adversarial-testing phases. It records existing controls as evidence and assumptions; it does not declare that those controls are complete, correctly deployed, or bypass-proof.
