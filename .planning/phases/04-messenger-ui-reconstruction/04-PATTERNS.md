# Phase 04: Messenger UI Reconstruction - Pattern Map

**Created:** 2026-06-08
**Scope:** Frontend chat UI component extraction, visual state reconstruction, and DOM tests.

## Closest Existing Analogs

| Planned Artifact | Role | Closest Existing Analog | Pattern To Preserve |
|------------------|------|-------------------------|--------------------|
| `ChatShell.tsx` | Layout shell | `Frontend/Chatify/src/pages/chat/chat.tsx` root layout | Keep route orchestration in the page and pass stable props into child components. |
| `ChatSidebar.tsx` | Sidebar container | Current sidebar JSX in `chat.tsx` | Keep independent sidebar scroll and chat selection behavior. |
| `ChatListItem.tsx` | Conversation row | Current mapped chat row in `chat.tsx` | Use `getChatTitle`, unread counts, latestMessage, and online state without refetching. |
| `ConversationPane.tsx` | Selected chat pane | Current selected-chat conditional in `chat.tsx` | Keep header/list/composer composition together. |
| `ConversationHeader.tsx` | Chat header | Current selected chat header in `chat.tsx` | Keep online/typing/header action data derived from selected chat and presence store. |
| `MessageList.tsx` | Scrollable message list | Current messages container and scroll handler | Preserve manual older-load and near-bottom auto-scroll behavior. |
| `MessageBubble.tsx` | Message row/bubble | Inline `MessageBubble` at bottom of `chat.tsx` | Preserve status, reactions, deleted/edited metadata, own/other alignment. |
| `MessageComposer.tsx` | Input and send controls | Current composer JSX in `chat.tsx` | Preserve Enter send, Shift+Enter newline, reply/edit previews, emoji trigger. |
| `MessageActionMenu.tsx` | Message actions | Current `contextMenu` JSX in `chat.tsx` | Preserve quick reactions, reply, edit, delete-for-self/everyone affordances. |
| `NewChatDialog.tsx` | New chat creation | Current new-chat modal state in `chat.tsx` | Preserve email payload and `useCreateChat` integration. |
| `ChatStateView.tsx` | Empty/error/offline/session states | Current scattered empty/error sections | Centralize copy from `04-UI-SPEC.md`. |
| `useChatViewState.ts` | Transient UI state | Current `useState` block in `chat.tsx` | Move drawer, search, menu, edit, reply, and picker state without durable messages. |
| `chatDisplay.ts` | Formatting helpers | Current `formatTimestamp`, `formatMessageDate`, `getChatTitle`, `getOtherMember` | Keep pure helpers easy to test and reuse. |

## Source Patterns

### Component Exports
- Existing components mostly default-export React components.
- Hooks/utilities use named exports.
- Recommendation: chat-specific components can default export and also be re-exported from `components/index.ts` to keep `chat.tsx` imports readable.

### Hook Boundaries
- `useChatQueries.ts` exports chat/message Query hooks and mutations.
- `useChatSocket.ts` owns socket lifecycle and event-to-cache integration.
- Recommendation: `useChatViewState.ts` must not call network APIs or own durable messages; keep it to view state and UI event helpers.

### Test Boundaries
- `messageCache.test.ts` uses Vitest explicit imports from `vitest`.
- Recommendation: keep component tests explicit (`describe`, `it`, `expect`, `vi`) and configure jest-dom in `src/test/setup.ts`.

### Styling Boundaries
- Existing `chat.css` owns scrollbar and animation classes.
- Recommendation: keep keyframes/scrollbars in `chat.css`, move layout/state styling to Tailwind classes in components.

## File Ownership By Plan

| Plan | Primary Ownership |
|------|-------------------|
| `04-01` | Component files, `useChatViewState`, `chatDisplay`, and `chat.tsx` orchestration. |
| `04-02` | UI-SPEC styling, state rendering, accessibility, lazy emoji picker, and recovery interactions. |
| `04-03` | RTL/jsdom dependencies, Vitest config/setup, DOM component tests, and smoke evidence. |

## Landmines

- Do not edit backend routes/controllers for Phase 4 unless a UI-blocking bug requires it.
- Do not create local durable message state in extracted components.
- Do not make actions hover-only; every core action needs a button/keyboard path.
- Do not make `chat.css` a broad design-system file.
- Do not remove existing search/export/reply/reaction/edit/delete affordances while extracting.
- Do not add permanent Playwright/e2e dependency unless a blocker requires it.
