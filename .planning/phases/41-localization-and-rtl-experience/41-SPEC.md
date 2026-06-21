# Phase 41 Specification - Localization And RTL Experience

## Objective

Chatify supports English and Arabic across representative core account, chat, settings, moderation, notification, and privacy workflows with locale-aware dates, persisted language preference, document direction updates, and RTL layout guardrails.

## Recommended Scope

- Add a frontend locale provider with English and Arabic dictionaries, persisted language preference, `lang`/`dir` document updates, and locale-aware date helpers.
- Add a Settings language control so users can switch between English and Arabic from the account workflow.
- Convert the highest-risk account, Settings, chat status, admin moderation, notification preference, privacy, and validation copy paths to the locale dictionary.
- Add RTL layout adjustments for chat/account/moderation surfaces where left/right assumptions can break mobile or desktop layouts.
- Add focused component tests for language switching, RTL document state, Arabic labels, date formatting, and representative chat/admin/settings workflows.

## Out Of Scope

- Full professional translation review by a native-language editor.
- Per-user backend-stored locale preference.
- Server-rendered email template localization beyond privacy-safe notification copy plumbing.
- Locale-specific pluralization beyond simple supported-copy forms.
- Full browser visual screenshot matrix unless a release-candidate pass is requested.

## Success Criteria

1. Users can switch between English and Arabic and the preference persists locally.
2. The document `lang` and `dir` attributes update correctly for English LTR and Arabic RTL.
3. Representative auth/account, chat, settings, moderation, notification, and privacy copy is sourced from translation dictionaries.
4. Dates/times and validation/error labels in the converted surfaces use the selected locale.
5. Focused tests cover language switching, RTL direction, Arabic strings, and representative account/chat/admin workflows.

## Recommendation

Use a lightweight internal i18n layer instead of adding a broad dependency. The app is a Vite SPA with no server rendering requirement, and a local provider keeps the first localization pass auditable while leaving room to migrate to i18next or FormatJS later if translation volume grows.
