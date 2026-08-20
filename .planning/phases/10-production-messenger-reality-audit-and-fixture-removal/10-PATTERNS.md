# Phase 10 Pattern Map

## Scope

Phase 10 is a production-reality audit and fixture-removal phase. The implementation must prove the messenger is using live server data, keep unsupported controls honest, and repair the desktop detail rail so it can be closed and reopened like the mobile drawer.

## Existing Patterns To Reuse

### Detail Surfaces

- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx` is the shared detail-content contract. Reuse it for desktop rail and mobile drawer so pinned messages, shared files, shared media, security rows, and action buttons stay in parity.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailDrawer.tsx` already has the mobile modal pattern: close button, backdrop close, Escape key close, focus on open, and delegated content rendering.
- `Frontend/Chatify/src/pages/chat/chat.tsx` already owns `isDetailDrawerOpen`, `detailButtonRef`, and `closeDetailDrawer`. Extend this ownership for desktop rail open/close state instead of adding independent state inside the rail.

### Header And Shell

- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` already exposes the details button through `detailButtonRef` and `onOpenDetails`.
- `Frontend/Chatify/src/pages/chat/components/ChatShell.tsx` is only a layout shell. Keep it lightweight; pass a controlled rail node from `chat.tsx` rather than moving data logic into the shell.

### Server-Truth Data

- `Frontend/Chatify/src/hooks/useChatQueries.ts` owns server-backed queries for messages, pinned messages, search results, shared files, shared media, unread counts, and mutations.
- `Frontend/Chatify/src/api/messageApi.ts` owns attachment preview/download URLs, search, pin/unpin, shared assets, and message transport calls.
- Detail content should continue rendering loading, error, empty, and data states from these hooks. Do not introduce literal pinned/file/media rows in runtime UI.

### Test And Evidence Patterns

- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` is the runtime guard that blocks historical fixture identifiers, fake media names, private storage internals, and living visual fixture terms from production chat runtime files.
- `Frontend/Chatify/e2e/pages/chatPage.ts` contains mocked local Playwright helpers for Phase 07 and Phase 09. Phase 10 production smoke must not reuse these mocked route installers for production truth evidence.
- `.planning/phases/09-messenger-interaction-quality-gate/09-BEHAVIOR-GATE.md` is the closest artifact pattern for recording commands, screenshots, and residual risk.

## Phase 10 Adaptation

- Add a desktop rail control contract to `ChatContextRail`: visible only when open on `xl`, closeable by button and Escape, with accessible labels and focus return to the header details button.
- Keep the mobile drawer as the mobile surface. Add/verify focus return through `closeDetailDrawer` when closed by Escape, backdrop, or close button.
- Add a production smoke spec or config path that is opt-in and explicitly no-mock. It should skip with a clear reason unless `CHATIFY_PRODUCTION_SMOKE=1`, production URLs, and smoke credentials are present.
- Expand runtime fixture leak guard coverage after the production audit identifies any leaked fake/static labels.

## Risks

- False positives: mocked Playwright tests can pass while production is broken. Mitigation: separate production smoke spec, no `page.route` for Chatify API/socket paths, and explicit audit artifact.
- Secret leakage: smoke credentials and production evidence can leak into artifacts. Mitigation: env-only credentials, redacted audit notes, no screenshots of secrets.
- Data leakage: attachment or storage internals can show in UI. Mitigation: runtime guard plus assertions against private storage terms.
- UI parity drift: desktop rail and mobile drawer can diverge. Mitigation: shared `ConversationDetailContent` plus paired component and e2e assertions.
