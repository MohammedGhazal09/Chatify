# Phase 41 Research - Localization And RTL Experience

## Findings

- React/Vite does not require a third-party i18n framework for a first dictionary-backed localization pass.
- `Intl.DateTimeFormat` can handle Arabic and English date/time formatting in the browser.
- Setting `document.documentElement.dir = "rtl"` is the correct root-level trigger for browser bidi behavior.
- Existing Tailwind physical utilities (`left`, `right`, `ml`, `mr`, `text-left`, `text-right`) may need targeted RTL guardrails, but should not be rewritten globally without visual review.

## Recommendation

Use `Intl.DateTimeFormat` and dictionary functions for Phase 41. Avoid broad automated class replacement; fix the concrete RTL breakpoints that tests and source review identify.
