# Phase 41 Context - Localization And RTL Experience

## Current State

- The frontend is a React/Vite SPA with most user-facing text hard-coded in TSX modules.
- Settings already contains account, notification, privacy, session, profile, identity, and moderation appeal controls.
- Admin moderation has protected report review, assignment, appeal review, metrics, and enforcement-history workflows.
- Chat layout uses Tailwind utility classes with several physical left/right assumptions that need RTL guardrails.
- No existing i18n framework, locale provider, translation dictionaries, or persisted language preference exists.

## Constraints

- Keep the current React/Vite/Tailwind stack.
- Avoid large framework rewrites or a global copy migration that cannot be reviewed.
- Do not expose private emails, tokens, raw report details, or secret configuration in localized copy.
- Prefer component-level tests and existing Vitest patterns.
- Keep release-candidate production smoke separate from local phase completion.

## Recommendation

Start with a dictionary-backed provider and convert the surfaces touched by recent account, moderation, privacy, notification, and chat work. This creates a stable pattern for future copy migration without blocking Phase 41 on every legacy sentence.
