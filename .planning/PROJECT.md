# Chatify

## What This Is

Chatify is a brownfield MERN real-time messaging app with React, Express, MongoDB, and Socket.IO. The existing product has account flows, private chat, presence, message status, and social login scaffolding, but the core chat experience needs to be rebuilt into a reliable, secure, polished messenger.

The current milestone is a reconstruction effort: stabilize message sending and receiving, redesign the chat UI, add a professional messenger baseline, and make security review a blocking part of the work.

## Core Value

Users can trust Chatify to deliver private real-time conversations reliably, securely, and clearly.

## Requirements

### Validated

- Existing React/Vite frontend application with protected and public routes.
- Existing Express/MongoDB backend with user, chat, message, and password reset models.
- Existing cookie-based authentication flow with email/password and OAuth strategy scaffolding.
- Existing Socket.IO integration for presence, typing, message events, and message status events.
- Existing codebase map covering architecture, stack, concerns, conventions, integrations, structure, and testing gaps.

### Active

- [ ] Reconstruct the chat page into a polished responsive messenger UI with clear sidebar, conversation view, composer, message actions, loading states, empty states, and error states.
- [ ] Rebuild message sending and receiving around a single canonical client/server contract that prevents duplicates, stale optimistic state, missed events, and unread-count drift.
- [ ] Authenticate Socket.IO connections from verified session data and enforce chat membership before any room join, typing, delivery, read, edit, delete, reaction, or notification event.
- [ ] Add a test baseline for authentication, message authorization, socket flows, optimistic updates, CSRF behavior, and validation boundaries.
- [ ] Enforce blocking security acceptance criteria for every auth, socket, and message phase.
- [ ] Add professional messenger baseline features: reliable direct messages, presence, typing, receipts, conversation search, message search, and account/session stability.
- [ ] Improve operational safety with redacted logging, bounded queues, explicit rate-limit behavior, and sanitized environment documentation.

### Out of Scope

- Native mobile apps - web-first reconstruction comes before platform expansion.
- End-to-end encryption - valuable later, but it changes message storage and delivery architecture and should not be mixed into the current reliability rebuild.
- Large-scale multi-tenant admin tooling - moderation/admin work can follow after private chat is trustworthy.
- Payments or monetization - unrelated to the current product risk.
- Full Slack/Discord clone scope - groups, channels, voice, bots, and integrations are deferred until the direct-message baseline is strong.

## Context

The user explicitly called out that the page UI is poor, the project lacks features, security review is missing, and message sending/receiving needs reconstruction. The first approved direction is:

- Priority: core chat loop first.
- V1 scope: professional messenger baseline.
- Security posture: blocking requirement, not an afterthought.

The existing codebase analysis identifies the main risk areas:

- `Frontend/Chatify/src/pages/chat/chat.tsx` is a large monolithic chat UI that couples layout, state, socket-derived behavior, and message actions.
- `Backend/Chatify/Config/socket.mjs` accepts client-supplied identity and does not consistently membership-check room actions.
- `Frontend/Chatify/src/hooks/useChatQueries.ts`, `Frontend/Chatify/src/hooks/useChatSocket.ts`, and `Frontend/Chatify/src/pages/chat/chat.tsx` spread optimistic message state and socket merge behavior across multiple places.
- CSRF scaffolding exists but route-level enforcement is inactive.
- Auth/token refresh, reset codes, logging, and profile artifacts need security review.
- No automated backend, frontend, or socket test suite is currently detected.

## Constraints

- **Tech stack**: Keep the existing React/Vite frontend, Express backend, MongoDB/Mongoose persistence, Socket.IO realtime layer, TanStack Query, Zustand, Tailwind, and npm package layout unless a phase proves a focused replacement is necessary.
- **Brownfield safety**: Preserve existing behavior until replacement paths are tested and verified; avoid broad rewrites without a phase boundary.
- **Security**: Cookie-authenticated requests, socket identity, message privacy, reset flows, and logs are security-sensitive and require tests or explicit verification evidence.
- **Delivery model**: Use GSD phases with standard granularity, parallel execution where plans are independent, and committed planning docs.
- **Repository hygiene**: Existing local work in `Frontend/Chatify/src/pages/chat/chat.tsx` must not be overwritten unless the user explicitly authorizes it.
- **Deployment**: Production references currently point to Render for backend and Vercel for frontend; CORS, cookies, and socket credentials must stay aligned.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rebuild core chat before broad features | Feature work will keep regressing if send/receive, socket auth, and message state remain unstable. | Pending |
| Target a professional messenger baseline for v1 | A minimal patch would leave the app feeling unfinished, while a full platform would spread risk too wide. | Pending |
| Make security blocking for auth, socket, and message phases | The app handles private messages and cookie-authenticated requests; review must be built into delivery. | Pending |
| Keep existing stack initially | The current stack can support the goal; the main problems are architecture, UX, authorization, and tests. | Pending |

## Evolution

This document must evolve as phases complete:

1. Move active requirements to Validated only after implementation and verification.
2. Move requirements to Out of Scope when they are explicitly rejected or deferred.
3. Add new requirements when reconstruction surfaces necessary product or security work.
4. Keep the Core Value focused on trustworthy private real-time conversations unless the product direction changes.
5. Record decisions that constrain future phases in the Key Decisions table.

---
*Last updated: 2026-06-07 after project initialization*
