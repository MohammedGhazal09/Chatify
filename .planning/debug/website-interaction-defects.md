---
status: fixed
trigger: "Voice call and video call stay pending forever; attachments open unavailable pages instead of a large popup; emoji picker closes after one emoji; user starring is disabled; detail More action does not toggle closed; message search flashes empty state before loading."
created: 2026-06-13
updated: 2026-06-13
---

# Debug Session: Website Interaction Defects

## Symptoms

- Expected behavior: Calls should reach the other user or fail honestly; attachments should preview in a large in-app popup; emoji pickers should stay open until manually closed; the star control should toggle; the detail More action should open and close; message search should show loading before results or no-results.
- Actual behavior: Calls can stay pending forever or fail to reach; attachment open actions navigate away to an unavailable page; emoji selection closes the picker; the star action is disabled; the detail More action only opens; search briefly renders an empty state.
- Error messages: Attachment destination says unavailable. No call error text was provided.
- Timeline: Unknown from user report.
- Reproduction: Use the chat page controls for call/video, attachment open, emoji selection, detail star/More, and message search.

## Current Focus

- hypothesis: Frontend interaction wiring is suppressing or misordering states, with call reachability tied too tightly to the selected chat socket lifecycle.
- test: Inspect chat socket/controller/component wiring, patch focused surfaces, then run component/unit tests and build.
- expecting: Socket stays connected for authenticated users, calls fail instead of hanging, attachment open actions stay in-app, pickers remain open, star/more/search states behave deterministically.
- next_action: Apply focused frontend fixes and add regression coverage.

## Evidence

- 2026-06-13: `useChatSocket` was enabled only when `selectedChatId` existed in `chat.tsx`, so authenticated users without an active selected chat had no reachable socket for incoming calls.
- 2026-06-13: `AttachmentPreview` and shared-file rows use direct protected preview links with `target="_blank"`, matching the unavailable-page symptom.
- 2026-06-13: `handleAppendEmoji` and `handleReaction` close their picker/menu after every selection.
- 2026-06-13: The conversation detail star button is explicitly disabled.
- 2026-06-13: `handleOpenMoreMenuFromDetails` always sets the menu open instead of toggling it.
- 2026-06-13: `useMessageSearch` only reports query loading after the debounce updates `debouncedQuery`, allowing a no-results render between typing and fetch.

## Eliminated

- hypothesis: The call feature is entirely absent.
  evidence: Phase 13 call backend, frontend controller, and socket tests exist.

## Resolution

- root_cause: The reported failures came from separate frontend interaction gaps: socket reachability depended on an active selected chat, incoming call acceptance depended on selected-chat state, call setup had no timeout, attachment open actions navigated to protected links, emoji handlers closed their menus immediately, the star action was disabled, the detail More action only opened, and search did not expose the debounce window as loading.
- fix: Keep chat sockets enabled for authenticated users, accept incoming calls by session chat id, add a call setup timeout, route attachment opens through a large in-app preview modal, leave emoji pickers open after selection, add user-scoped local conversation starring, make the detail More action toggle, and surface search debounce/fetch time as loading.
- verification: `npm run test -- useCallController.test.tsx useChatQueries.test.tsx ConversationPane.test.tsx MessageList.test.tsx ChatContextRail.test.tsx ConversationDetailDrawer.test.tsx MessageActionMenu.test.tsx MessageComposer.test.tsx MessageBubble.test.tsx`; `npm run lint`; `npm run build`; `npm run test`.
- files_changed: `Frontend/Chatify/src/hooks/useCallController.ts`, `Frontend/Chatify/src/hooks/useChatQueries.ts`, `Frontend/Chatify/src/pages/chat/chat.tsx`, chat component files under `Frontend/Chatify/src/pages/chat/components`, focused regression tests, and `Frontend/Chatify/src/pages/chat/components/AttachmentPreviewModal.tsx`.
