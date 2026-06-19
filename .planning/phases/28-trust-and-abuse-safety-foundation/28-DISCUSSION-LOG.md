# Phase 28 Discussion Log

## Decisions

| Topic | Decision | Rationale |
|---|---|---|
| Report scope | Support user, message, and conversation reports | Covers V2-MOD-01 without building a broad admin suite. |
| User reports | Require a shared chat for user reports | Avoids arbitrary user-id probing and keeps reports grounded in an existing relationship. |
| Admin authority | Add server-side `role` with `select: false` and `requireAdmin` middleware | Prevents client-side role spoofing and avoids exposing role in normal user payloads. |
| Redaction | Redact emails, bearer tokens, secret/password/cookie fields, and long token-like strings | Meets SEC-02 and avoids storing unnecessary private data in review context. |
| UI shape | Add immediate report actions to existing menus with toast outcomes | Keeps the first user-facing surface small and avoids a new modal policy flow before moderation policy is defined. |

## Recommendation

Recommendation: keep report reason defaulted to `other` from menu actions for this phase and add a richer category/details dialog later when the moderation policy is defined. The backend already supports structured reasons, so the future dialog can be added without changing the API contract.
