# Phase 11: Conversation Controls And User Safety Implementation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 11-conversation-controls-and-user-safety-implementation
**Areas discussed:** Block persistence and API contract, Conversation capability state, Realtime and HTTP block enforcement, Search and More menu behavior, Detail surfaces and security rows, Cache invalidation and frontend states, Verification and dependency gates, Module boundaries and error contract

---

## Block Persistence And API Contract

| Option | Description | Selected |
|--------|-------------|----------|
| User arrays | Store blocked ids directly on user documents. | |
| Chat embedded state | Store block state directly on the chat document. | |
| Separate `UserBlock` collection | Store directed user-level relationships with unique blocker/blocked pair and timestamps. | ✓ |

**User's choice:** Approved recommendation.
**Notes:** Block/unblock remains direct-message-only, chat-scoped in the API, idempotent, authenticated, membership-checked, and history-preserving.

---

## Conversation Capability State

| Option | Description | Selected |
|--------|-------------|----------|
| Client inference | Let the frontend infer capabilities from chat/user/socket state. | |
| Dedicated endpoint only | Fetch controls from a separate API after selected chat load. | |
| Serialized controls on chat responses | Add `conversationControls` to chat responses and return updated controls from block/unblock. | ✓ |

**User's choice:** Approved recommendation.
**Notes:** Recommended fields are `canSendMessage`, `canBlockUser`, `canUnblockUser`, `blockedByMe`, `blockedMe`, and `messagingDisabledReason`. Counterpart copy remains neutral.

---

## Realtime And HTTP Block Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| HTTP-only enforcement | Reject blocked sends but leave socket signals unchanged. | |
| Duplicate checks per handler | Add individual block checks wherever needed. | |
| Shared capability helper | Use shared backend helpers from HTTP and Socket.IO boundaries. | ✓ |

**User's choice:** Approved recommendation.
**Notes:** Blocked pairs may still access authorized history, but new message, typing, presence/last-seen, delivery/read, reaction, pin/unpin, edit, delete-for-everyone, and future call-attempt signals are suppressed.

---

## Search And More Menu Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Keep More as details | Leave the header More button opening details directly. | |
| Add a real action menu | Header/detail More opens an accessible menu with only supported actions. | ✓ |
| Add broad placeholder actions | Show planned actions disabled or inert for visual completeness. | |

**User's choice:** Approved recommendation.
**Notes:** Supported menu actions are Search messages, Block/Unblock user, and Conversation details. Search result jumps should first use bounded loading through existing cursor history.

---

## Detail Surfaces And Security Rows

| Option | Description | Selected |
|--------|-------------|----------|
| Keep per-section empty rows | Show "No pinned/shared/media" rows under every section. | |
| Hide empty sections with one combined empty state | Render server-backed data, hide empty optional sections, and show one honest empty state if all optional content is empty. | ✓ |
| Keep static placeholders | Preserve fake-looking rows for layout parity. | |

**User's choice:** Approved recommendation.
**Notes:** Shared assets preserve cursor metadata and expose Load more. Security rows must state only verifiable runtime facts and degrade honestly on missing evidence.

---

## Cache Invalidation And Frontend States

| Option | Description | Selected |
|--------|-------------|----------|
| Page reload after mutations | Refresh the whole app after block/unblock. | |
| Broad query invalidation | Invalidate all chat-related server state. | |
| Targeted invalidation plus immediate controls update | Update returned controls and invalidate only affected chat/message/detail keys. | ✓ |

**User's choice:** Approved recommendation.
**Notes:** Composer disables when controls say sending is unavailable. Stale 403 sends mark optimistic rows failed, refresh controls, and show recoverable copy.

---

## Verification And Dependency Gates

| Option | Description | Selected |
|--------|-------------|----------|
| Backend-only tests | Prove block APIs and message rejection only. | |
| Frontend-only tests | Prove visible controls only. | |
| Layered verification | Backend API/socket tests, frontend tests, lint/build, and focused Playwright desktop/mobile light/dark coverage. | ✓ |

**User's choice:** Approved recommendation.
**Notes:** Phase 11 can proceed locally, but production-ready claims remain blocked by Phase 10.1 live delivery smoke or a documented production-smoke blocker.

---

## Module Boundaries And Error Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Add logic directly into large files | Implement all behavior inside existing controllers and `chat.tsx`. | |
| Focused helpers and typed contracts | Add a block model, shared capability helpers, chat API methods, query hooks, and focused menu/control components. | ✓ |
| Broad rewrite | Replace the current chat architecture for controls. | |

**User's choice:** Approved recommendation.
**Notes:** Preserve existing React/Vite, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, and Tailwind stack. Preserve unrelated local work.

---

## the agent's Discretion

- Exact helper, model, route-handler, component, hook, and test file names.
- Whether a dedicated controls refresh endpoint is needed after implementation research.
- Whether unloaded search jumping needs a new backend endpoint after trying bounded cursor loading.
- Exact user-facing copy, as long as blocker copy is actionable and counterpart copy is neutral.

## Deferred Ideas

- Full audio/video calls remain Phase 13.
- Voice messages and identity image/mark editing remain Phase 12.
- Delete/archive conversation actions need a separate per-user archive/delete contract.
- Full conversation export remains out of scope until a safe complete-history export contract exists.
- Final deployed product acceptance remains Phase 14.
