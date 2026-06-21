# Phase 34: Advanced Message And Asset Search - Specification

**Created:** 2026-06-20
**Mode:** Auto-approved inline execution
**Requirements:** V2-SEARCH-01, V2-SEARCH-02, MSG-03, MEDIA-02, BASE-02, TEST-03, TEST-05

## Goal

Extend the existing conversation-scoped message search so users can filter authorized results by sender, date range, text, media, file, link, and voice-message type, then jump to a matching message even when it is outside the currently loaded message cache.

## Current State

- Backend `GET /api/message/search/:chatId` searches visible message text plus active attachment display names.
- The search endpoint enforces chat membership and excludes messages deleted for the requester or deleted for everyone.
- Frontend message search opens from the conversation header and renders results in `MessageSearchResults`.
- Results only jump when the target message is already loaded in the TanStack messages cache.
- Shared asset endpoints already classify media, file, and voice attachments.

## Target State

- Search accepts structured filters for `senderId`, `from`, `to`, and `type`.
- Supported type filters are `all`, `text`, `media`, `file`, `link`, and `voice`.
- Empty text queries are accepted when a non-text filter is present, so users can browse filtered assets or sender/date results.
- Results include match metadata that lets the UI explain why a result matched.
- A jump endpoint returns an authorized message window around the selected result so older unloaded matches can be opened without manually paging history.
- Frontend search controls stay compact and predictable on desktop and mobile.

## Recommendations

1. Extend the existing search endpoint instead of adding a parallel search subsystem.
   - Rationale: membership, visibility, deletion, attachment, and cache behavior already converge there.
2. Add a bounded message-context endpoint for jump-to-result.
   - Rationale: it avoids deep cursor walking in the browser and keeps authorization server-owned.
3. Use simple query-string filters rather than a POST body for this phase.
   - Rationale: search remains cacheable in TanStack Query and easy to regression-test.
4. Treat attachment metadata as searchable, but do not search file contents.
   - Rationale: this preserves the existing privacy and storage boundary.
5. Keep link search based on visible text URLs, not URL unfurling or attachment crawling.
   - Rationale: link previews and crawlers are separate privacy-sensitive features.

## Acceptance Criteria

- [ ] Search validates and applies sender, date range, and type filters for authorized conversations.
- [ ] Search excludes unauthorized chats, requester-hidden messages, deleted-for-everyone tombstones, and deleted attachments.
- [ ] Media, file, and voice filters match active attachment metadata without searching attachment contents.
- [ ] Link filtering finds visible text URLs only.
- [ ] Result payloads include filter metadata without exposing private emails or hidden attachment data.
- [ ] Jumping to an unloaded result loads an authorized message window and highlights the target message.
- [ ] Backend and frontend tests cover direct, group, media/file/voice/link, empty-result, and jump-to-message behavior.

## Out Of Scope

- Global cross-conversation search.
- Full-text indexes, stemming, ranking, saved searches, search analytics, or OCR/file-content search.
- Search inside opt-in encrypted conversations before Phase 36 defines runtime encrypted-message behavior.
