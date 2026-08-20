# Phase 41 Discussion Log - Localization And RTL Experience

## Decisions

- Use English and Arabic as the initial supported locales.
- Persist the selected locale in browser local storage for this phase.
- Update `document.documentElement.lang` and `document.documentElement.dir` from the locale provider.
- Use local dictionaries and typed helpers instead of introducing a third-party i18n runtime.

## Recommendations

- Default to English when stored locale data is missing or invalid.
- Treat Arabic copy as functional product copy that should receive native-language review before marketing or launch claims.
- Prefer logical CSS and `dir`-aware attributes for new layout fixes; avoid large visual rewrites during the localization pass.
