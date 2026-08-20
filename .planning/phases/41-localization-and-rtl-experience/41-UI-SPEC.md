# Phase 41 UI Specification - Localization And RTL Experience

## User Experience

- Settings exposes a compact language control with English and Arabic options.
- Switching language updates visible copy, date/time formatting, and document direction immediately.
- RTL mode keeps account, chat, and moderation controls readable without clipped text, overlapping controls, or reversed semantic order.
- Message text and usernames should remain readable in mixed-language conversations.

## Accessibility

- The language control uses native radio/select semantics or clearly labelled buttons.
- `lang` and `dir` attributes update on the root document element.
- Screen-reader labels for converted controls use the selected language.
- Keyboard focus order remains unchanged when layout direction changes.

## Recommendation

Use native controls for language selection in Settings. This avoids custom segmented-control keyboard edge cases while the localization foundation is still new.
