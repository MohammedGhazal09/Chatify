# Research: Pitfalls

**Date:** 2026-06-07
**Scope:** Chatify messenger reconstruction

## Pitfall: Treating Socket.IO Rooms As Authorization

Rooms are a broadcast mechanism, not an access-control system. A socket must only join a chat room after the server verifies membership.

**Prevention:** Gate every room join and room event through a backend membership helper. Derive socket identity from verified session data, not client-supplied ids.

**Phase mapping:** Security/test foundation and realtime contract phases.

## Pitfall: Assuming Socket Delivery Means Messenger Reliability

Socket.IO preserves ordering, but default delivery is at-most-once. A disconnected client can miss server events.

**Prevention:** Persist messages first, emit after persistence, refetch on reconnect, and add an offset/replay strategy when the event stream needs stronger guarantees.

**Phase mapping:** Realtime contract and message state phases.

## Pitfall: Spreading Optimistic State Across UI And Sockets

If mutation responses, socket events, and UI state each merge messages independently, duplicates and stale status become likely.

**Prevention:** Centralize message merging in query hooks. Use snapshots, rollback, invalidation, server ids, and optimistic correlation ids.

**Phase mapping:** Message state phase and frontend chat rebuild phase.

## Pitfall: Shipping A UI Redesign Without State Contracts

Visual polish will not survive if send, receive, unread, and status semantics remain ambiguous.

**Prevention:** Establish message contract and test coverage before major UI component extraction. UI phases can then render clear states instead of compensating for unreliable data.

**Phase mapping:** Message state phase before full UI polish.

## Pitfall: Leaving CSRF As Scaffolding

Cookie-authenticated unsafe HTTP requests need active CSRF enforcement or a documented equivalent control.

**Prevention:** Apply CSRF validation to unsafe methods, verify frontend token/header behavior, keep exemptions explicit, and test accepted/rejected cases.

**Phase mapping:** Security/test foundation phase.

## Pitfall: Logging Secrets Or Identifiers While Debugging Auth

Direct logs around tokens, users, emails, OAuth, cookies, and sockets can expose private data.

**Prevention:** Replace direct debug logs with structured redacted logging and environment-gated debug output.

**Phase mapping:** Security/test foundation phase.

## Pitfall: Adding Advanced Features Before Direct Messages Are Trustworthy

Groups, attachments, notifications, and moderation multiply the state and authorization surface.

**Prevention:** Defer platform expansion until the direct-message baseline has reliable tests, authorization, and UI states.

**Phase mapping:** V2 roadmap, not initial reconstruction.

