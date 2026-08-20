# Phase 05: Messenger Baseline Completion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 05-messenger-baseline-completion
**Areas discussed:** Direct-chat continuation, message search API, message search UI, sidebar search, navigation continuity, session and presence cleanup, verification and accessibility

---

## Direct-Chat Continuation

| Decision | Options Presented | Selected |
|----------|-------------------|----------|
| Direct-chat uniqueness key | deterministic `directKey` with partial unique index; application-only retry; array-member unique index | deterministic `directKey` with partial unique index |
| Duplicate create race handling | surface `409`; catch duplicate and re-query; serialize requests in app memory | catch duplicate and re-query |
| Create chat error privacy | detailed reason; generic failure; detailed only in development | specific invalid-email format, generic account/self/private lookup failure |
| Existing chat socket side effects | emit every submit; emit only for newly created chats; never emit | emit only for newly created chats |

**User's choice:** Approved all recommendations.
**Notes:** The chosen path preserves exact-email start/continue while preventing account enumeration and concurrent duplicate chats.

---

## Message Search API

| Decision | Options Presented | Selected |
|----------|-------------------|----------|
| Route shape | `GET /api/message/search/:chatId?q=...`; query param on history endpoint; frontend-only search | `GET /api/message/search/:chatId?q=&limit=25` |
| Response shape | canonical `Message[]`; custom result objects; text-only snippets | canonical `Message[]` |
| Query implementation | escaped case-insensitive regex; Mongo text index; external search service | escaped case-insensitive regex |
| Deleted and edited message search | current visible text only; include edit history; include tombstone copy | current visible text only |

**User's choice:** Approved all recommendations.
**Notes:** The route stays selected-chat-only and uses existing requester visibility rules.

---

## Message Search UI

| Decision | Options Presented | Selected |
|----------|-------------------|----------|
| Hook boundary | inside `ChatPage`; new `useMessageSearch`; inside `useMessages` | new `useMessageSearch(chatId, query)` |
| Search result interaction | always jump/load context; scroll only if loaded; read-only result rows | scroll/highlight only if already loaded, otherwise snippet row |

**User's choice:** Approved all recommendations.
**Notes:** Search results are server state but must not replace durable message history in TanStack Query.

---

## Sidebar Search

| Decision | Options Presented | Selected |
|----------|-------------------|----------|
| Search fields | title only; title plus latest visible snippet; include member email | title plus latest visible snippet |
| Empty state copy | mention messages; mention contacts; mention conversations and New chat | "No matching conversations" plus New chat guidance |

**User's choice:** Approved all recommendations.
**Notes:** The sidebar search remains local and must not trigger passive account or presence lookup.

---

## Navigation Continuity

| Decision | Options Presented | Selected |
|----------|-------------------|----------|
| Restore priority | URL first; localStorage first; first chat always | URL first, then per-user localStorage, then most recent chat |
| Invalid `chatId` handling | show error; clear/replace URL and fallback; keep blank state | replace URL without invalid param and fallback safely |
| Per-user storage key | one global key; per-user key; sessionStorage only | `chatify_selected_chat_${user._id}` |

**User's choice:** Approved all recommendations.
**Notes:** The root chat route is preserved; selected-chat state uses query params and per-user persistence.

---

## Session And Presence Cleanup

| Decision | Options Presented | Selected |
|----------|-------------------|----------|
| Auth refresh failure cleanup | handle only in page errors; import auth store in Axios; dispatch auth-expired event | dispatch `chatify:auth-expired` event |
| Presence cleanup scope | query cache only; presence only; query cache plus chat view plus presence/typing | query cache plus chat view plus presence/typing |
| Presence source | add REST endpoint; use Socket.IO only; hybrid | use Socket.IO only |
| Typing cleanup | rely on timeout only; clear on selected-chat change; clear on chat change/auth loss plus timeout | timeout plus clear on selection/auth loss |

**User's choice:** Approved all recommendations.
**Notes:** This preserves Phase 02 presence privacy and adds explicit cleanup for stale UI state.

---

## Verification And Accessibility

| Decision | Options Presented | Selected |
|----------|-------------------|----------|
| Backend test placement | extend existing files; add focused chat/message files; create new framework folder | add focused files under existing backend test structure |
| Frontend test placement | only Playwright; only component tests; component tests plus focused smoke | component tests plus focused smoke |
| Playwright smoke scope | only existing smoke; full workflow matrix; focused additions | focused additions |
| Accessibility expectations | minimal labels; keyboard/focus/live-region coverage; defer a11y | keyboard/focus/live-region coverage |

**User's choice:** Approved all recommendations.
**Notes:** Fast tests cover edge cases and Playwright proves critical user-visible v1 flows.

---

## Agent Discretion

- Exact helper filenames, controller helper names, and utility placement are left to the planner/executor.
- Exact privacy-safe copy is left to the planner/executor as long as it avoids account enumeration.
- Exact search result component boundaries and highlight helper shape are left to the planner/executor.
- Exact test split between helper-level and integration-level search normalization tests is left to the planner/executor.

## Deferred Ideas

- Fuzzy global user/contact search.
- Global all-chat message search.
- Jump-to-context for unloaded older search results.
- REST presence endpoint.
- Broad account/profile/password settings.
