# Phase 29: Privacy And Encryption Design Spike - Specification

**Created:** 2026-06-19
**Ambiguity score:** 0.12 (gate: <= 0.20)
**Requirements:** V2-E2EE-01, SEC-01, SEC-02, MSG-03, MSG-04

## Goal

Decide whether and how Chatify should support end-to-end encrypted conversations before any implementation starts.

## Decision

Recommendation: do not retrofit end-to-end encryption into the existing plaintext message model. Add E2EE later as an explicit opt-in conversation mode with separate key management, encrypted message payloads, encrypted attachments, generic notifications, and a moderation/reporting design that acknowledges the server cannot inspect encrypted content.

## Requirements

1. Distinguish current transport security, server-side privacy controls, and true E2EE.
2. Define key creation, backup, rotation, device change, lost-access, and multi-device behavior.
3. Document tradeoffs for search, attachments, moderation, reporting, account recovery, and notifications.
4. Define how encrypted conversations coexist with existing direct and group conversations.
5. Scope implementation into later phases with clear acceptance criteria.

## Boundaries

**In scope:**
- Threat model and privacy boundary.
- E2EE architecture recommendation.
- Key-management design.
- Migration and compatibility plan.
- Future phase breakdown.

**Out of scope:**
- Implementing encryption.
- Changing message, attachment, socket, or search runtime behavior.
- Claiming Signal-grade forward secrecy.
- Breaking existing standard conversations.

## Acceptance Criteria

- [x] Threat model differentiates TLS, server-side storage privacy, and E2EE.
- [x] Key lifecycle and lost-device behavior are documented.
- [x] Search, attachment, moderation, reporting, recovery, and notification tradeoffs are documented.
- [x] Migration plan preserves existing standard conversations and scopes E2EE to new opt-in conversations.
- [x] Future implementation phases are proposed with acceptance criteria.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|---|---:|---:|---|---|
| Goal Clarity | 0.94 | 0.75 | PASS | Design-only outcome is explicit. |
| Boundary Clarity | 0.90 | 0.70 | PASS | No runtime code changes in this phase. |
| Constraint Clarity | 0.90 | 0.65 | PASS | Existing plaintext message model and moderation constraints are concrete. |
| Acceptance Criteria | 0.92 | 0.70 | PASS | Required design artifacts are listed. |
| **Ambiguity** | 0.12 | <=0.20 | PASS | Cryptographic primitive selection remains implementation-phase work. |

---

*Phase: 29-privacy-and-encryption-design-spike*
*Spec created: 2026-06-19*
