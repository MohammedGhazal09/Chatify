# Phase 11 Research: Conversation Controls and User Safety Implementation

## Scope

Phase 11 converts the remaining static chat controls into reliable product behavior:

- closable conversation details panel and consistent entry points from desktop and mobile
- real message search from the existing message data, including unloaded result jumps
- functional conversation More menu
- directed direct-message block and unblock
- backend and socket enforcement so blocked users cannot create new message activity
- server-backed pinned messages, shared files, shared media, and honest security rows
- accessibility, cache, and verification coverage that prevents static fixtures from returning

This phase does not replace Phase 10.1 message delivery verification. Phase 11 depends on that delivery contract for final production readiness and must keep its verification evidence separate when Phase 10.1 live two-user smoke remains incomplete.

## Skills Used

- `websocket-engineer`: socket room semantics, event acknowledgements, suppression boundaries, reconnect considerations.
- `api-and-interface-design`: stable REST contracts for block/unblock, conversation controls, search, and detail payloads.
- `accessibility`: keyboard and screen-reader behavior for More menu, search panel, detail drawer, and disabled composer states.
- `e2e-testing-patterns`: realistic end-to-end coverage for multi-user chat behavior and fixture-leak prevention.
- `tanstack-query`: cache invalidation and query-key design for chat controls, shared assets, and blocked state transitions.
- `mongodb`: persistence shape and indexes for directed block relations and message/detail queries.

## External Findings

### Socket.IO Rooms and Broadcasts

Source: https://socket.io/docs/v4/rooms/

Socket.IO rooms are server-side channels. Clients do not have access to the list of rooms they are in. The server can emit to every socket in a room with `io.to(room).emit(...)`, or to everyone in a room except the sender with `socket.to(room).emit(...)`.

Implications for Phase 11:

- Blocking cannot rely on the client to leave rooms honestly. The server must decide whether to persist, emit, suppress, or reject each chat event.
- Existing room membership can remain for history and self-only events, but active events must be filtered before broadcast.
- Socket tests must cover both HTTP message send and socket-originated events because either path can bypass a UI-only disabled state.

### TanStack Query Invalidation

Source: https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation

TanStack Query invalidation marks matching queries stale and can refetch active queries. It is designed to coordinate server-state changes without manually normalizing every cache entry.

Implications for Phase 11:

- Block/unblock should update the selected chat controls immediately and invalidate targeted chat/message/detail keys.
- Broad invalidation should be avoided for ordinary menu actions so the chat UI does not flicker or lose scroll state.
- Search and shared-asset query keys need to include `chatId`, search term, cursor/page, and type filters.

### WAI-ARIA Menu Button Pattern

Source: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/

The menu button pattern uses a button that opens a menu, exposes popup state, and supports keyboard interaction.

Implications for Phase 11:

- The More control should be a real button with `aria-haspopup`, `aria-expanded`, and deterministic focus behavior.
- Menu actions must remain reachable by keyboard and close on Escape, outside click, successful action, and route/chat changes.
- Disabled actions should explain state through accessible text where needed instead of silently doing nothing.

### Mongoose Indexes and Schema Contracts

Source: https://mongoosejs.com/docs/guide.html#indexes

Mongoose schemas define document structure and indexes. Compound indexes can be declared at the schema level and are created through the model lifecycle.

Implications for Phase 11:

- Directed user blocks should use a dedicated collection with a unique compound index on `{ blocker, blockedUser }`.
- Query helpers should resolve both directions for a direct chat in one bounded query.
- Message detail queries should use existing chat/message indexes where possible and add focused indexes only if the implementation proves a query gap.

## Codebase Findings

### Current Backend Shape

- Chat access and message persistence are already guarded through controllers and models, but block-specific semantics do not exist yet.
- Socket handling is centralized in `Backend/Chatify/Config/socket.mjs`; this is the right enforcement point for realtime events such as message send, typing, read, delivery, reaction, edit, delete-for-everyone, pin, unpin, and future call attempts.
- Chat and message controllers already emit socket events after persistence. Phase 11 must add shared backend helpers so HTTP and socket paths cannot drift.
- A dedicated `UserBlock` model is lower risk than overloading `Chat`, because a user may block the same person across direct chat contexts and the relation is directional.

Recommendation:

Build backend block/controls first, with direct-chat-only API endpoints and shared helpers that every event path calls before active interaction.

### Current Frontend Shape

- The chat page already owns orchestration, but earlier phases split some behavior into components and hooks. Phase 11 should continue extracting only where it reduces risk.
- Detail panel, pinned/shared/security sections, and media/file cards must be driven from live message/chat data, not fixture arrays.
- Header and detail-panel controls currently have enough visual affordance to support real actions, but need consistent state, dialogs/menus, and disabled/error paths.
- Search should reuse the message data source and only add a new backend endpoint if bounded cursor loading cannot reach an unloaded result cleanly.

Recommendation:

Wire controls through typed API methods and TanStack Query hooks first, then update components to consume capability state and backend-provided detail data.

### Test and Verification Shape

- Phase 11 needs backend tests for block model/helper/controller/socket paths.
- Frontend tests need to prove controls are interactive and stateful, especially More menu open/close, search result jump, shared asset rendering, and blocked composer behavior.
- E2E needs two-user scenarios where one user blocks another, sends are rejected or disabled, realtime active signals stop, and history remains visible.
- Static fixture regressions should be caught by tests that fail if the pinned/shared/media sections render canned values when no data exists.

Recommendation:

Keep implementation split into three waves: backend contract, frontend behavior, integrated verification/evidence.

## Recommended Phase Plan

1. `11-01`: Backend conversation controls and block enforcement.
2. `11-02`: Frontend controls, message search, detail data, and accessibility behavior.
3. `11-03`: Integrated verification, live-smoke evidence, and static-fixture guard.

This order reduces risk because the UI cannot honestly become functional until the server owns the capability state and enforcement contract.

## Open Risks

- If Phase 10.1 delivery reliability is still not proven in live two-user production smoke, Phase 11 can validate locally and in tests but should not be marked production ready.
- If the current message indexes cannot support search/shared queries with acceptable bounds, Phase 11 may need a narrowly scoped backend endpoint or index addition.
- If production call/video infrastructure does not exist, Phase 11 should expose honest disabled menu/call states instead of pretending those actions are functional.
