# Phase 32 Code Review

**Scope:** Backend notification preference/outbox/provider runtime, frontend settings integration, tests, and env documentation.

## Result

PASS - no unresolved blocking findings.

## Findings

### Resolved During Review

1. **Email resubscribe kept unsubscribe state**
   - **Risk:** A user could turn email notifications back on in settings while `emailUnsubscribedAt` still suppressed delivery server-side.
   - **Fix:** `updateNotificationPreferences` now clears `notificationPreferences.emailUnsubscribedAt` when `emailNotificationsEnabled` is set true.
   - **Verification:** `notification.preferences.test.mjs` covers unsubscribe then resubscribe; full `npm run quality` passes.

2. **Expanded notification preference type required socket test/default updates**
   - **Risk:** The socket hook could receive incomplete preference fixtures and build could fail.
   - **Fix:** Updated `useChatSocket` defaults and tests with the complete preference contract.
   - **Verification:** focused frontend tests and full quality pass.

## Security Review Notes

- Outbox payloads use generic templates and tests assert private message markers and recipient email are absent.
- Push endpoint values are stored only in user subscription state and are referenced from outbox jobs by endpoint hash.
- User JSON serialization strips push subscriptions, unsubscribe token hash, and unsubscribe timestamp.
- Provider failure persistence stores sanitized error strings only.
- Preference mutations are authenticated and CSRF-protected.
- Message idempotent retries do not duplicate external notification jobs.

## Residual Risks

- Production push delivery requires real VAPID values and browser subscription verification in a secret-bearing environment.
- The outbox worker is intentionally simple for this phase; multi-instance production deployment may need a stronger claim/recovery mechanism before high scale.

## Verification

- `npm test -- notification.preferences.test.mjs notification.outbox.test.mjs notification.delivery.test.mjs message.idempotency.test.mjs`
- `npm test -- useNotificationPreferences.test.tsx SettingsModal.test.tsx useChatSocket.test.tsx`
- `npm run ops:check`
- `npm run quality`

## Recommendation

Proceed to Phase 33 with server mute state treated as the authoritative notification suppression source. Before production push rollout, run a secret-bearing smoke that registers a real push subscription and verifies one dry-run-disabled provider attempt without exposing endpoint values.
