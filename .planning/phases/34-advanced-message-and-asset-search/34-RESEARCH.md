# Phase 34 Research

## Codebase Findings

- Existing backend search:
  - Validates membership through `loadChatForUser`.
  - Uses `buildVisibleMessageFilter` with `includeTombstones: false`.
  - Searches visible message text and active attachment `displayName`.
  - Caps results at 25.
- Existing frontend search:
  - Debounces input in `useMessageSearch`.
  - Stores search results separately from durable messages cache.
  - Only lets users jump to results already loaded in the current message list.
- Existing asset model:
  - Message attachment summaries include `kind` values for `media`, `file`, and `voice`.
  - Attachment records include active/deleted status and display metadata.

## Recommendation

Use query normalization plus indexed bounded queries for this phase. A future phase can add full-text indexes or cross-conversation search if product scope requires ranking and global result navigation.
