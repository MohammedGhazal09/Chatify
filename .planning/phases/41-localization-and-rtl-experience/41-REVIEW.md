# Phase 41 Code Review - Localization And RTL Experience

## Findings

No unresolved blocking findings remain.

## Fixed During Review

- Split `useLocale` and the locale context out of `LocaleProvider.tsx` so React Fast Refresh lint rules pass.
- Kept the language preference line out of `role="status"` so it does not collide with existing Settings action-result status assertions.
- Added `dir="auto"` to message text and chat state copy to let the browser choose bidi direction for mixed Arabic/English content.

## Reviewed Areas

- Locale runtime defaults to English and rejects invalid stored locale values.
- Arabic selection persists to local storage and updates root `lang="ar"` and `dir="rtl"`.
- Date/time formatting uses `Intl.DateTimeFormat` with the selected locale.
- Settings exposes the language control and translated representative account, privacy, notification, session, and moderation-account-safety labels.
- Admin moderation uses translated representative access, queue, detail, appeal, assignment, review, audit, operations-summary, and metric labels.
- Message text and chat state copy use automatic bidi direction without changing message ownership alignment or state semantics.

## Residual Limitations

- Arabic copy is functional product copy and still needs native-language review before release or marketing claims.
- This phase converts representative high-risk surfaces, not every legacy hard-coded string in the app.
- Locale preference is browser-local only; backend-stored per-user locale is deferred.
- Server-generated email/push template localization is not fully implemented in this phase.
- No Playwright screenshot matrix was run for Arabic RTL desktop/mobile; component tests, lint, build, and source review cover the local phase scope.
