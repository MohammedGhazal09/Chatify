# Phase 32 Research Notes

## Source Findings

- Phase 30 notification design defines the required server preferences: push opt-in, email opt-in, preview mode defaulting to no content, muted chat IDs, unsubscribe state, and provider status logging.
- Existing local notification code already avoids private copy in browser alerts through `getSafeNotificationCopy`.
- Existing direct-chat block controls expose `filterUnblockedContactIds`, which can suppress direct-chat notifications without duplicating block-query logic.
- Existing message idempotency flow calls `finalizeMessageCreate` for both new messages and idempotent retries. External notification enqueue must run outside the retry branch or be explicitly guarded.
- Existing Brevo email service can be extended for generic notification mail, but provider calls must be isolated behind a service so tests can run without network.

## Risk Assessment

- Privacy risk: notification templates could accidentally include text, attachment names, email addresses, or push endpoints. Mitigation: central generic template helpers and tests that search job payloads/log-like results.
- Duplicate delivery risk: retries and concurrent creates could enqueue duplicate jobs. Mitigation: unique dedupe key by recipient/message/channel and enqueue only for new creates.
- Safety risk: blocked or muted conversations could still notify users. Mitigation: eligibility checks before enqueue plus backend tests.
- Provider risk: missing credentials in local/CI could fail tests. Mitigation: dry-run provider behavior outside production and sanitized production config failures.
- UI risk: adding server preferences could make settings flaky if the API fails. Mitigation: local fallback, pending/error text, and no regression to sound/browser-alert toggles.

## Recommended Test Matrix

- Preference API defaults and partial updates.
- Muted chat persistence and validation.
- Enqueue skips sender, muted chat, blocked direct peer, unsubscribed email, and missing push subscription.
- Enqueue dedupes idempotent/concurrent message create paths.
- Processor marks dry-run success and retries sanitized failures.
- Settings modal renders email/push controls and keeps browser permission flow explicit.
