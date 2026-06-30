# Phase 42: Contact Requests And Trusted Conversation Onboarding - Specification

**Created:** 2026-06-30
**Ambiguity score:** 0.10 (gate: <= 0.20)
**Requirements:** 6 locked

## Goal

Users must approve a new one-to-one contact request before a new direct conversation appears, while existing direct chats and group/space conversations keep working.

## Background

Chatify already supports username-only direct chat creation, contact listing from shared chats, block-aware presence, groups, spaces, and profile privacy. The current direct-chat endpoint creates a new private chat immediately when a valid username is submitted. There is no pending request, recipient approval, incoming/outgoing request list, or onboarding state that explains why a new user cannot message yet.

## Requirements

1. **Pending request creation**: Starting a new standard direct conversation with a non-contact creates or returns a pending contact request instead of creating a chat immediately.
   - Current: `POST /api/chat/create-new-chat` creates a new direct chat as soon as the target username is valid and unblocked.
   - Target: A new contact request is created or reused for the requester/recipient pair when no trusted direct conversation exists.
   - Acceptance: A backend test proves a first request returns request data and leaves `Chats.countDocuments({ isGroupChat: false })` unchanged.

2. **Accepted request creates chat**: Accepting a pending incoming request creates or returns the direct chat for both users.
   - Current: There is no request lifecycle and no approval step.
   - Target: Recipient acceptance marks the request accepted, creates or returns the direct chat, joins both users to the socket room, and emits privacy-safe updates.
   - Acceptance: A backend test proves accept creates one direct chat, returns public member identity only, and notifies both sides without email exposure.

3. **Request lifecycle controls**: Users can list incoming/outgoing pending requests, decline incoming requests, and cancel outgoing requests.
   - Current: Contacts are inferred only from existing shared chats.
   - Target: Authenticated users can inspect pending request state and resolve it without creating chat records.
   - Acceptance: Backend and frontend tests cover list, decline, cancel, idempotent pending reuse, and unauthorized request access.

4. **Privacy and block safety**: Contact requests use usernames/public identity only and respect existing block controls.
   - Current: Direct chat creation already rejects blocked users and avoids email in chat payloads.
   - Target: Request creation, list, accept, decline, cancel, logs, and socket payloads expose no private emails and reject blocked/self/missing/invalid targets safely.
   - Acceptance: Tests and source search prove request payloads do not contain `"email"` or raw account email values.

5. **Trusted onboarding UI**: The chat UI explains request state clearly without decorative dead controls.
   - Current: New chat UI says "Start or continue chat" and treats every valid username as an immediate chat attempt.
   - Target: Direct start copy and contact request panels distinguish pending sent, pending received, accepted/continued, rejected, loading, and error states.
   - Acceptance: Component tests prove the dialog submits the request path, shows pending copy, and exposes accept/decline/cancel actions with accessible labels.

6. **Existing behavior preservation**: Existing direct chats, group chats, spaces, blocked controls, and encrypted conversation limitations remain intact.
   - Current: Existing direct-chat continuation returns 200 and groups/spaces have separate creation flows.
   - Target: Existing direct chats continue immediately, group/space flows are not gated by contact requests, and encrypted direct chat onboarding is deferred until a separate encrypted-contact decision.
   - Acceptance: Focused regression tests for existing direct continuation, group creation, and blocked direct attempts still pass.

## Boundaries

**In scope:**
- Backend contact request persistence, serializer, routes, and membership/ownership checks.
- Request-aware standard direct-chat creation and acceptance flow.
- Incoming/outgoing request list for the authenticated user.
- Chat UI request onboarding, request status copy, and accept/decline/cancel controls.
- Focused backend/frontend tests, lint/build, and visual QA evidence.

**Out of scope:**
- Broad friend graph, follower model, public directory, suggestions, imports, or recommendations - this phase only gates direct conversation onboarding.
- Group or space invite links - Phase 47 owns expiring and revokable invite links.
- Username autocomplete or fuzzy discovery - Phase 21 intentionally chose exact username lookup.
- Contact request expiration - useful later, but Phase 47 owns expiration semantics.
- Encrypted contact requests - encrypted conversation key sharing needs a separate decision and must not be hidden inside this phase.
- Native push/email notifications for requests - existing notification runtime can be extended later if needed.

## Constraints

- Keep username-only public identity; do not expose email in request payloads, logs, traces, or screenshots.
- Reuse existing Express, Mongoose, Socket.IO, TanStack Query, and chat UI patterns.
- Preserve existing direct chat continuation semantics for already-created direct chats.
- Do not add a new UI dependency for request controls.
- Cookie-authenticated unsafe request mutations must remain CSRF-protected through the existing chat route protection.

## Acceptance Criteria

- [ ] A first standard direct chat attempt to a non-contact creates or returns a pending contact request without creating a chat.
- [ ] Existing direct chats still return the chat immediately.
- [ ] Recipient acceptance creates or returns exactly one direct chat and updates both users.
- [ ] Incoming/outgoing lists, decline, and cancel are ownership-checked and privacy-safe.
- [ ] Blocked, self-target, missing-user, and invalid-username paths remain safe and generic where appropriate.
- [ ] Chat UI exposes request sent, incoming request, accept, decline, cancel, loading, empty, and error states without layout overlap on desktop and mobile.
- [ ] Backend tests, frontend tests, lint/build, and Hercules visual QA evidence are recorded.

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes |
|--------------------|-------|------|--------|-------|
| Goal Clarity       | 0.95  | 0.75 | PASS   | Target outcome is a request gate before new standard direct chats. |
| Boundary Clarity   | 0.92  | 0.70 | PASS   | Social graph, discovery, invite links, expiration, and encrypted request scope are excluded. |
| Constraint Clarity | 0.88  | 0.65 | PASS   | Username privacy, CSRF, existing chat continuation, and no new UI dependency are explicit. |
| Acceptance Criteria| 0.86  | 0.70 | PASS   | Backend, frontend, and visual checks are falsifiable. |
| **Ambiguity**      | 0.10  | <=0.20 | PASS | Ready for discussion and planning. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today for direct onboarding? | Username direct chat creation exists; no request model or recipient approval exists. |
| 1 | Researcher | What triggers this phase? | New direct conversations appear without trust context; contact request approval is missing. |
| 2 | Simplifier | What is the minimum useful version? | Pending incoming/outgoing request lifecycle for standard direct chats only. |
| 3 | Boundary Keeper | What is explicitly not this phase? | No social graph, directory, suggestions, invite links, expiration, or encrypted key-sharing workflow. |
| 4 | Failure Analyst | What would make the phase unsafe? | Email exposure, bypassable request gate, blocked-user request delivery, duplicate direct chats, or dead UI controls. |
| 5 | Seed Closer | What evidence proves completion? | Tests for request lifecycle and direct-chat preservation plus browser-visible request UI evidence. |

---

*Phase: 42-contact-requests-and-trusted-conversation-onboarding*
*Spec created: 2026-06-30*
*Next step: $gsd-discuss-phase 42 - implementation decisions*
