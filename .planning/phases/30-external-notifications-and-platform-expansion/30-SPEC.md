# Phase 30: External Notifications And Platform Expansion - Specification

**Created:** 2026-06-19
**Ambiguity score:** 0.13 (gate: <= 0.20)
**Requirements:** V2-NOTF-01, V2-PLAT-01, V2-PLAT-02, V2-PLAT-03, SEC-02, TEST-05

## Goal

Define the safe expansion path beyond the private messenger baseline: cross-device push/email notifications, bounded channels or shared spaces, and bots/integrations with scoped permissions.

## Decision

Recommendation: do not implement Phase 30 runtime features yet. Phase 19 already added local in-browser notification preferences and generic privacy-safe copy, but Chatify does not yet have server-side notification preferences, push subscriptions, email notification delivery, an outbox/queue, delivery observability, channels/spaces, or integration permissioning. Those must be later implementation phases after release evidence, moderation, and encryption tradeoffs are accepted.

## Requirements

1. Define external push/email notification architecture that is opt-in, privacy-safe, rate-limited, observable, and respects mute/block/session/encryption state.
2. Define notification templates that avoid private message leakage by default.
3. Define bounded channels/spaces as a conservative extension, not a broad Discord/Slack clone.
4. Define bot/integration requirements for scopes, revocation, audit trails, webhook verification, and abuse controls.
5. Keep implementation blocked until release evidence, Phase 28 moderation, and Phase 29 encryption decisions are reconciled.

## Boundaries

**In scope:**
- Push/email notification contract and rollout design.
- Provider, queue, preference, rate-limit, and observability requirements.
- Channels/spaces product boundary.
- Bots/integrations permission model.
- Later implementation phase breakdown.

**Out of scope:**
- Implementing service workers, VAPID keys, email notification jobs, channels, bots, or integrations.
- Adding production provider secrets.
- Sending message content through email/push by default.
- Using Phase 30 to claim release readiness.

## Acceptance Criteria

- [x] External notification design respects opt-in, mute, block, E2EE, and privacy-safe copy.
- [x] Push/email delivery is scoped into later phases with queue, rate limit, and observability requirements.
- [x] Channels/spaces are bounded and explicitly not broad platform cloning.
- [x] Bots/integrations require scoped permissions, revocation, audit trails, and abuse controls before runtime execution.
- [x] Requirement traceability marks Phase 30 as design-complete/deferred implementation.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|---|---:|---:|---|---|
| Goal Clarity | 0.92 | 0.75 | PASS | Design/handoff outcome is explicit. |
| Boundary Clarity | 0.90 | 0.70 | PASS | Runtime implementation is deferred. |
| Constraint Clarity | 0.90 | 0.65 | PASS | Privacy, release, moderation, and E2EE gates are explicit. |
| Acceptance Criteria | 0.90 | 0.70 | PASS | Phase artifacts define implementation handoff. |
| **Ambiguity** | 0.13 | <=0.20 | PASS | Provider choice remains future implementation work. |

---

*Phase: 30-external-notifications-and-platform-expansion*
*Spec created: 2026-06-19*
