# Research: Architecture

**Date:** 2026-06-07
**Scope:** Chatify messenger reconstruction

## Target Shape

Chatify should keep the existing layered architecture, but the chat domain needs clearer ownership boundaries.

## Backend Boundaries

### Auth Boundary

- `protect` middleware remains the HTTP identity source.
- Socket.IO handshake middleware must verify the same session or token material and attach a trusted `socket.data.userId`.
- Refresh-token behavior should be separated from access-token verification and covered by tests.

### Chat Access Boundary

- Create one reusable backend membership helper for chat access.
- Use the helper in message controllers, chat controllers, and socket event handlers.
- Never trust `userId` or `chatId` from the client without deriving or checking authorization server-side.

### Message Contract Boundary

- Define one server response/event shape for messages.
- Include stable ids, sender, chat, content, timestamps, status fields, reactions, deleted-for semantics, and optimistic correlation id where needed.
- Make send/edit/delete/reaction/read/delivered operations idempotent.

### Realtime Boundary

- Socket connection:
  1. Verify identity during handshake.
  2. Load authorized chat ids.
  3. Join user and chat rooms server-side.
  4. Reject unauthorized room or event requests.
- Reconnect:
  1. Refetch conversation list and selected messages.
  2. Use cursor or last-seen offsets for missed events when implemented.
  3. Reconcile message statuses by server truth.

## Frontend Boundaries

### Chat Page Shell

`Frontend/Chatify/src/pages/chat/chat.tsx` should become a composition shell, not the place where all chat behavior lives.

Recommended split:

- `ChatLayout` for responsive structure.
- `ConversationSidebar` for list, search, unread, presence.
- `ConversationHeader` for selected chat metadata and actions.
- `MessageList` for history, grouping, scrolling, and virtualized/paginated loading if needed.
- `MessageBubble` for per-message display states.
- `MessageComposer` for input, send, disabled, and retry states.
- `MessageActions` or dedicated hooks for edit, delete, reaction, read/delivered transitions.

### Client Data Boundary

- TanStack Query owns server state.
- Zustand owns session/presence state only when it is not better modeled as server state.
- Optimistic message writes should happen in one hook-level merge path, not directly in many UI components.

## Data Flow

1. User selects a conversation.
2. Query loads messages by cursor and excludes messages deleted for the current user.
3. User sends a message with a local optimistic id.
4. HTTP mutation persists the message and returns canonical server message.
5. Socket event broadcasts canonical message to authorized room participants.
6. Frontend merge logic deduplicates optimistic and socket/server messages by server id or optimistic correlation id.
7. Reconnect or refetch reconciles statuses, unread counts, and missed messages from server truth.

## Build Order

1. Add test harness and security guardrails.
2. Authenticate sockets and centralize chat membership checks.
3. Define canonical message event/response merge semantics.
4. Split chat UI and rebuild visual/interaction states.
5. Add search and account/session polish.

