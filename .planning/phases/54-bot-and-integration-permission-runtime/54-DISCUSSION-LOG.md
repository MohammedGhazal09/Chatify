---
phase: 54
created: 2026-07-01
---

# Phase 54 Discussion Log

## Decisions

- Use fixed scopes instead of free-form permissions.
- Support space and group targets only; direct conversations remain out of scope.
- Return runtime tokens only once on install or rotation and store hashes only.
- Keep runtime limited to manifest identity in this phase.
- Add admin diagnostics as aggregate visibility, not a manual execution console.

## Recommendations

- Add message read/write runtime only after moderation, abuse reporting, and E2EE guardrails are explicitly designed for bot-originated activity.
- Add signed inbound webhooks in a later phase with replay protection and per-installation rate limits.
